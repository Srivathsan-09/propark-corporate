import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to view your rides." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // 1. Fetch rides offered by user (Driver view)
    const offeredRides = await Ride.find({ driver: session.user.id })
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity availableSeats")
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each offered ride with its incoming passenger requests
    const rideIds = offeredRides.map((r) => r._id);
    const requests = await RideRequest.find({ ride: { $in: rideIds } })
      .populate("passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const requestsByRide = new Map<string, any[]>();
    requests.forEach((req) => {
      const rId = req.ride.toString();
      if (!requestsByRide.has(rId)) {
        requestsByRide.set(rId, []);
      }
      requestsByRide.get(rId)!.push(req);
    });

    const enrichedOfferedRides = offeredRides.map((ride) => ({
      ...ride,
      requests: requestsByRide.get(ride._id.toString()) || [],
    }));

    // 2. Fetch rides requested / booked by user (Passenger view)
    const rawBookedRides = await RideRequest.find({ passenger: session.user.id })
      .populate({
        path: "ride",
        populate: [
          { path: "driver", select: "name email phone companyName department profileImage employeeId" },
          { path: "vehicle", select: "vehicleModel vehicleType registrationNumber vehiclePhoto" },
        ],
      })
      .populate("driver", "name email phone companyName department profileImage")
      .sort({ createdAt: -1 })
      .lean();

    const validBookedRides = await Promise.all(
      rawBookedRides
        .filter((b) => b && b.ride && (b.ride as any).driver && (b.ride as any).vehicle)
        .map(async (b: any) => {
          let pin = b.boardingPin;
          if (b.status === "accepted" && (!pin || pin.trim() === "")) {
            const hexVal = parseInt(b._id.toString().slice(-4), 16);
            const mathPin = Math.floor(1000 + Math.random() * 9000);
            pin = String(!isNaN(hexVal) ? 1000 + (hexVal % 9000) : mathPin);
            try {
              await RideRequest.updateOne({ _id: b._id }, { $set: { boardingPin: pin } });
            } catch (e) {}
          }
          return {
            ...b,
            boardingPin: pin || (b.status === "accepted" ? "4829" : ""),
          };
        })
    );

    return NextResponse.json({
      success: true,
      offeredRides: enrichedOfferedRides,
      bookedRides: validBookedRides,
    });
  } catch (error: unknown) {
    console.error(" My Rides GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch rides history." },
      { status: 500 }
    );
  }
}
