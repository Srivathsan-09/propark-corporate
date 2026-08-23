import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Vehicle from "@/models/Vehicle";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in to view coworker profiles." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id || (!mongoose.Types.ObjectId.isValid(id) && id.length !== 24)) {
      return NextResponse.json(
        { success: false, error: "Invalid employee identifier format." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(id).select("-passwordHash").lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found." },
        { status: 404 }
      );
    }

    // Fetch user vehicles
    const vehicles = await Vehicle.find({ owner: user._id })
      .select("vehicleModel vehicleType registrationNumber seatingCapacity verificationStatus isApproved vehiclePhoto")
      .lean();

    // Fetch commute statistics
    const [ridesOffered, ridesCompleted, ridesTaken] = await Promise.all([
      Ride.countDocuments({ driver: user._id }),
      Ride.countDocuments({ driver: user._id, status: "completed" }),
      RideRequest.countDocuments({ passenger: user._id, status: "accepted" }),
    ]);

    return NextResponse.json({
      success: true,
      profile: {
        ...user,
        vehicles: vehicles || [],
        stats: {
          ridesOffered,
          ridesCompleted,
          ridesTaken,
        },
      },
    });
  } catch (error: any) {
    console.error("Coworker profile GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve employee profile." },
      { status: 500 }
    );
  }
}
