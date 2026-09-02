import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Vehicle from "@/models/Vehicle";
import Notification from "@/models/Notification";
import { offerRideSchema } from "@/validations/ride.schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET: Fetch single ride details by ID (used for Edit Ride pre-population)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ride = await Ride.findById(id)
      .populate("driver", "name email phone companyName department profileImage")
      .populate("vehicle")
      .lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ride,
    });
  } catch (error: any) {
    console.error("GET ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch ride." },
      { status: 500 }
    );
  }
}

/**
 * PUT: Update an existing scheduled ride
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ride = await Ride.findById(id);

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    // Verify driver ownership
    const isDriver =
      ride.driver.toString() === session.user.id ||
      session.user.role === "admin" ||
      (session.user.email && (ride.driver as any).email?.toLowerCase() === session.user.email.toLowerCase());

    if (!isDriver) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only edit your own rides." },
        { status: 403 }
      );
    }

    if (ride.status !== "scheduled") {
      return NextResponse.json(
        { success: false, error: "Only scheduled rides can be edited. In-progress or completed rides cannot be modified." },
        { status: 400 }
      );
    }

    const body = await req.json();

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

    // Verify Vehicle
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Selected vehicle not found." },
        { status: 404 }
      );
    }

    ride.vehicle = new mongoose.Types.ObjectId(vehicleId);
    ride.vehicleType = vehicle.vehicleType;
    ride.rideType = rideType;
    ride.startingLocation = startingLocation;
    ride.destination = destination;
    if (startLocation) ride.startLocation = startLocation;
    if (endLocation) ride.endLocation = endLocation;
    if (typeof distanceKm === "number") ride.distanceKm = distanceKm;
    if (typeof durationMinutes === "number") ride.durationMinutes = durationMinutes;
    ride.departureDate = departureDate;
    ride.departureTime = departureTime;
    ride.totalSeats = availableSeats;
    ride.availableSeats = availableSeats;
    ride.stops = stops;
    ride.notes = notes || "";

    await ride.save();

    return NextResponse.json({
      success: true,
      message: "Ride updated successfully.",
      ride,
    });
  } catch (error: any) {
    console.error("PUT ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update ride." },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Cancel & delete a scheduled ride
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ride = await Ride.findById(id).populate("driver", "name email phone companyName");

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    // Verify session user is the driver (or admin)
    const isDriver =
      ride.driver._id.toString() === session.user.id ||
      session.user.role === "admin" ||
      (session.user.email && (ride.driver as any).email?.toLowerCase() === session.user.email.toLowerCase());

    if (!isDriver) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only delete your own offered rides." },
        { status: 403 }
      );
    }

    // 1. Find all passenger requests for this ride embedded in Ride document
    const requests = ride.requests || [];

    // 2. Notify all passengers who requested or were accepted
    const notificationPromises = requests.map(async (reqItem: any) => {
      try {
        await Notification.create({
          recipient: reqItem.passenger,
          title: "Ride Cancelled & Deleted",
          message: `The ride from ${ride.startingLocation} to ${ride.destination} scheduled for ${ride.departureDate} at ${ride.departureTime} has been cancelled and deleted by the driver.`,
          type: "ride_request",
          link: "/rides/find",
        });
      } catch (err) {
        console.warn("Failed to send ride deletion notification:", err);
      }
    });

    await Promise.all(notificationPromises);

    // 3. Delete the ride itself
    await Ride.findByIdAndDelete(ride._id);

    return NextResponse.json({
      success: true,
      message: "Ride deleted successfully.",
    });
  } catch (error: any) {
    console.error("Delete ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete ride." },
      { status: 500 }
    );
  }
}
