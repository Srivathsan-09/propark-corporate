import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import CarbonEmission from "@/models/CarbonEmission";
import Ride from "@/models/Ride";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    rideId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { rideId } = params;
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const record = await CarbonEmission.findOne({ rideId })
      .populate("driverId", "name email department companyName")
      .populate("vehicleId", "vehicleModel vehicleType registrationNumber fuelType")
      .populate("passengers.userId", "name email department");

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Carbon emission record not found for this ride." },
        { status: 404 }
      );
    }

    // Permission check: driver, passenger, or admin
    const isDriver = record.driverId?._id?.toString() === session.user.id;
    const isPassenger = (record.passengers || []).some(
      (p: any) => p.userId?._id?.toString() === session.user.id || p.userId?.toString() === session.user.id
    );
    const isAdmin = session.user.role === "admin" || session.user.role === "campus_admin";

    if (!isDriver && !isPassenger && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied to this ride's carbon data." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      carbonEmission: record,
    });
  } catch (error: any) {
    console.error(" Ride Carbon GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve carbon emission details." },
      { status: 500 }
    );
  }
}
