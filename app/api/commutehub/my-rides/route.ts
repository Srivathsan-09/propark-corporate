import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Hub from "@/models/Hub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const userId = session.user.id;

    // 1. Hub rides offered as driver
    const offeredRides = await Ride.find({
      driver: userId,
      hubId: { $ne: null },
    })
      .populate("hubId")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity")
      .populate("requests.passenger", "name email phone department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Hub rides booked as passenger
    const bookedRides = await Ride.find({
      "requests.passenger": userId,
      hubId: { $ne: null },
    })
      .populate("hubId")
      .populate("driver", "name email phone department profileImage employeeId")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto")
      .sort({ createdAt: -1 })
      .lean();

    const formattedBookedRides: any[] = [];
    bookedRides.forEach((ride: any) => {
      const myReq = (ride.requests || []).find(
        (r: any) => (r.passenger?._id || r.passenger)?.toString() === userId
      );
      if (myReq) {
        formattedBookedRides.push({
          ...myReq,
          ride: {
            ...ride,
            requests: undefined,
          },
          hub: ride.hubId,
          driver: ride.driver,
        });
      }
    });

    return NextResponse.json({
      success: true,
      offeredRides,
      bookedRides: formattedBookedRides,
    });
  } catch (error: any) {
    console.error("CommuteHub My Rides GET Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch your hub rides." },
      { status: 500 }
    );
  }
}
