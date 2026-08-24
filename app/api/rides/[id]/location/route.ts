import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import User from "@/models/User";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET: Fetch live driver GPS position and ride telemetry
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
      .populate("vehicle", "vehicleModel vehicleType registrationNumber")
      .lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      currentLocation: ride.currentLocation || null,
      status: ride.status,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
      driver: ride.driver,
      vehicle: ride.vehicle,
      startLocation: ride.startLocation,
      endLocation: ride.endLocation,
      startingLocation: ride.startingLocation,
      destination: ride.destination,
      stops: ride.stops,
      distanceKm: ride.distanceKm,
      durationMinutes: ride.durationMinutes,
    });
  } catch (error: unknown) {
    console.error(" Live Location GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve live location." },
      { status: 500 }
    );
  }
}

/**
 * POST: Driver updates live GPS coordinates
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
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

    const body = await req.json();
    const { latitude, longitude, heading, speed, accuracy } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Latitude and longitude coordinates are required." },
        { status: 400 }
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

    const ride = await Ride.findById(id);

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    // Verify driver ownership
    const isDriver =
      (dbUser && ride.driver.toString() === dbUser._id.toString()) ||
      ride.driver.toString() === session.user.id ||
      session.user.role === "admin";

    if (!isDriver) {
      return NextResponse.json(
        { success: false, error: "Only the driver can broadcast live GPS coordinates." },
        { status: 403 }
      );
    }

    // Atomically update location
    ride.currentLocation = {
      latitude,
      longitude,
      heading: heading || null,
      speed: speed || null,
      accuracy: accuracy || null,
      lastUpdated: new Date(),
    };

    // If still marked scheduled, ensure it transitions to in_progress
    if (ride.status === "scheduled") {
      ride.status = "in_progress";
      ride.startedAt = new Date();
    }

    await ride.save();

    return NextResponse.json({
      success: true,
      currentLocation: ride.currentLocation,
      status: ride.status,
    });
  } catch (error: unknown) {
    console.error(" Live Location POST API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update live GPS location." },
      { status: 500 }
    );
  }
}
