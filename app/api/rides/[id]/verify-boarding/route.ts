import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { requestId, passengerId, boardingPin } = body;

    if (!boardingPin || !boardingPin.trim()) {
      return NextResponse.json(
        { success: false, error: "4-digit boarding security PIN is required." },
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

    // Verify caller is the assigned driver
    if (ride.driver.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the designated ride driver can verify passenger boarding." },
        { status: 403 }
      );
    }

    const requestQuery: any = { ride: ride._id, status: "accepted" };
    if (requestId && mongoose.Types.ObjectId.isValid(requestId)) {
      requestQuery._id = requestId;
    } else if (passengerId && mongoose.Types.ObjectId.isValid(passengerId)) {
      requestQuery.passenger = passengerId;
    }

    const rideRequest = await RideRequest.findOne(requestQuery).populate("passenger", "name email employeeId phone");

    if (!rideRequest) {
      return NextResponse.json(
        { success: false, error: "No active accepted booking found for this passenger." },
        { status: 404 }
      );
    }

    // Validate 4-digit PIN
    if (rideRequest.boardingPin !== boardingPin.trim()) {
      return NextResponse.json(
        { success: false, error: "Invalid Boarding PIN. Please verify the 4-digit code shown on the passenger's screen." },
        { status: 400 }
      );
    }

    // Mark passenger as boarded
    rideRequest.isBoarded = true;
    rideRequest.boardedAt = new Date();
    await rideRequest.save();

    // If ride is scheduled, automatically transition to in_progress
    if (ride.status === "scheduled") {
      ride.status = "in_progress";
      ride.startedAt = new Date();
      await ride.save();
    }

    return NextResponse.json({
      success: true,
      message: `Verified! ${(rideRequest.passenger as any)?.name || "Passenger"} is safely boarded.`,
      rideRequest,
      rideStatus: ride.status,
    });
  } catch (error: any) {
    console.error("Verify boarding error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify passenger boarding PIN." },
      { status: 500 }
    );
  }
}
