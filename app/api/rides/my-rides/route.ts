import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
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
      .populate("requests.passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch rides requested / booked by user (Passenger view)
    const passengerRides = await Ride.find({ "requests.passenger": session.user.id })
      .populate("driver", "name email phone companyName department profileImage employeeId")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto")
      .populate("requests.passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const validBookedRides: any[] = [];
    passengerRides.forEach((ride: any) => {
      const myRequests = (ride.requests || []).filter(
        (r: any) => (r.passenger?._id || r.passenger)?.toString() === session.user.id
      );

      myRequests.forEach((req: any) => {
        let pin = req.boardingPin;
        if (req.status === "accepted" && (!pin || pin.trim() === "")) {
          const hexVal = parseInt(req._id.toString().slice(-4), 16);
          pin = String(!isNaN(hexVal) ? 1000 + (hexVal % 9000) : "4829");
        }

        validBookedRides.push({
          ...req,
          ride: {
            ...ride,
            requests: undefined, // Avoid circular nesting
          },
          driver: ride.driver,
          boardingPin: pin || (req.status === "accepted" ? "4829" : ""),
        });
      });
    });

    return NextResponse.json({
      success: true,
      offeredRides,
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
