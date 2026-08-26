import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User";

export const dynamic = "force-dynamic";
import Notification from "@/models/Notification";
import { offerRideSchema } from "@/validations/ride.schema";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const date = searchParams.get("date");
    const vehicleType = searchParams.get("vehicleType");
    const rideType = searchParams.get("rideType");
    const maxPrice = searchParams.get("maxPrice");
    const campusIdParam = searchParams.get("campusId");

    const query: Record<string, any> = {
      status: { $in: ["scheduled", "in_progress"] },
      availableSeats: { $gt: 0 },
    };

    // Scoped by physical campus (Campus Isolation)
    const effectiveCampusId = campusIdParam || session?.user?.campusId;
    if (effectiveCampusId && effectiveCampusId !== "all") {
      query.campusId = effectiveCampusId;
    }

    if (origin) {
      query.startingLocation = { $regex: origin, $options: "i" };
    }

    if (destination) {
      query.destination = { $regex: destination, $options: "i" };
    }

    if (date) {
      query.departureDate = date;
    }

    if (vehicleType && vehicleType !== "all") {
      query.vehicleType = vehicleType;
    }

    if (rideType && rideType !== "all") {
      query.rideType = rideType;
    }

    if (maxPrice) {
      const numPrice = Number(maxPrice);
      if (!isNaN(numPrice)) {
        query.$or = [
          { "stops.price": { $lte: numPrice } },
          { basePrice: { $lte: numPrice } },
        ];
      }
    }

    const rides = await Ride.find(query)
      .populate("driver", "name email employeeId companyName department phone profileImage verificationStatus isApproved")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity availableSeats verificationStatus isApproved")
      .sort({ departureDate: 1, departureTime: 1 })
      .lean();

    const currentUserId = session?.user?.id;

    // Contact Privacy Masking: Mask personal phone and email in public search
    const securedRides = rides.map((ride: any) => {
      const isOwner = currentUserId && ride.driver?._id?.toString() === currentUserId;
      if (!isOwner && ride.driver) {
        const rawPhone = ride.driver.phone || "";
        const rawEmail = ride.driver.email || "";

        const maskedPhone = rawPhone.length > 4 
          ? rawPhone.slice(0, 3) + " ••••• ••" + rawPhone.slice(-2)
          : "••••••••••";

        const emailParts = rawEmail.split("@");
        const maskedEmail = emailParts.length === 2 && emailParts[0].length > 2
          ? emailParts[0][0] + "•••••" + emailParts[0].slice(-1) + "@" + emailParts[1]
          : "•••••@corporate.com";

        return {
          ...ride,
          driver: {
            ...ride.driver,
            phone: maskedPhone,
            email: maskedEmail,
            isContactMasked: true,
          },
        };
      }
      return ride;
    });

    return NextResponse.json({
      success: true,
      rides: securedRides,
    });
  } catch (error: unknown) {
    console.error(" Rides GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch available rides." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to offer a ride." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    let dbUser: any = null;
    if (session.user.id && mongoose.Types.ObjectId.isValid(session.user.id)) {
      dbUser = await User.findById(session.user.id).lean();
    }
    if (!dbUser && session.user.email) {
      dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
    }

    console.log("[POST /api/rides] Session user:", session.user?.email, "DB user found:", dbUser?.name, "Approved:", dbUser?.isApproved, dbUser?.verificationStatus);

    const isEmployeeApproved =
      Boolean(
        dbUser &&
          (dbUser.role === "admin" ||
            dbUser.isApproved === true ||
            dbUser.verificationStatus === "approved" ||
            dbUser._doc?.isApproved === true ||
            dbUser._doc?.verificationStatus === "approved")
      );

    if (!dbUser || !isEmployeeApproved) {
      console.warn("[POST /api/rides] Blocked: Employee is not approved", dbUser);
      return NextResponse.json(
        {
          success: false,
          error: "Your employee account is pending campus admin approval. You can offer rides once approved.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Validate request data
    const validationResult = offerRideSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((e) => e.message);
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: errorMessages,
        },
        { status: 400 }
      );
    }

    const {
      vehicleId,
      rideType,
      startingLocation,
      destination,
      startLocation,
      endLocation,
      distanceKm,
      durationMinutes,
      departureDate,
      departureTime,
      availableSeats,
      stops,
      notes,
    } = validationResult.data;

    // Check vehicle exists and belongs to user
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Selected vehicle not found in registered fleet." },
        { status: 404 }
      );
    }

    if (vehicle.owner.toString() !== dbUser._id.toString() && dbUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Selected vehicle does not belong to your account." },
        { status: 403 }
      );
    }

    const isVehicleApproved =
      dbUser.role === "admin" ||
      vehicle.isApproved === true ||
      vehicle.verificationStatus === "approved" ||
      (isEmployeeApproved && vehicle.verificationStatus !== "rejected");

    if (!isVehicleApproved) {
      return NextResponse.json(
        {
          success: false,
          error: "This vehicle is awaiting campus security/admin verification before it can offer rides.",
        },
        { status: 403 }
      );
    }

    if (availableSeats > vehicle.seatingCapacity) {
      return NextResponse.json(
        {
          success: false,
          error: `Seats offered (${availableSeats}) cannot exceed vehicle total capacity (${vehicle.seatingCapacity}).`,
        },
        { status: 400 }
      );
    }

    // Determine basePrice as the highest stop price or last stop price
    const basePrice = stops.length > 0 ? stops[stops.length - 1].price : 0;

    // Create the Ride in MongoDB
    const newRide = await Ride.create({
      driver: dbUser._id,
      vehicle: vehicle._id,
      vehicleType: vehicle.vehicleType,
      rideType: rideType || "pickup",
      startingLocation,
      destination,
      startLocation: startLocation || { address: startingLocation, latitude: 0, longitude: 0 },
      endLocation: endLocation || { address: destination, latitude: 0, longitude: 0 },
      distanceKm: distanceKm || 0,
      durationMinutes: durationMinutes || 0,
      departureDate,
      departureTime,
      totalSeats: availableSeats,
      availableSeats,
      basePrice,
      stops: stops || [],
      notes: notes || "",
      campusId: dbUser.campusId || "CAMP001",
      status: "scheduled",
      acceptedPassengers: [],
    });

    // Populate for return
    const populatedRide = await Ride.findById(newRide._id)
      .populate("driver", "name email employeeId companyName campusName department phone profileImage")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto");

    // Broadcast Notification to campus colleagues in the SAME physical campus
    try {
      const otherEmployees = await User.find({
        _id: { $ne: session.user.id },
        campusId: dbUser.campusId || "CAMP001",
        isApproved: true,
      })
        .select("_id")
        .limit(20);

      if (otherEmployees.length > 0) {
        const notifications = otherEmployees.map((emp) => ({
          recipient: emp._id,
          sender: session.user.id,
          title: `New ${vehicle.vehicleType} Ride Offered`,
          message: `${dbUser.name} (${dbUser.companyName}) offered a ride from ${startingLocation} to ${destination} on ${departureDate} at ${departureTime}.`,
          type: "ride_posted",
          ride: newRide._id,
        }));
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error("Broadcast notification error (non-fatal):", notifErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ride posted successfully! Colleagues can now discover and book seats.",
        ride: populatedRide,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(" Ride POST API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to post ride. Please try again." },
      { status: 500 }
    );
  }
}
