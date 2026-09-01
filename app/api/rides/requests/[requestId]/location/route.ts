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
    requestId: string;
  };
}

/**
 * POST: Passenger broadcasts live GPS position
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { requestId } = params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride request identifier." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { latitude, longitude, heading, speed, accuracy } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid latitude and longitude coordinates are required." },
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

    const ride = await Ride.findOne({ "requests._id": requestId });
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride request not found." },
        { status: 404 }
      );
    }

    const rideRequest: any = ride.requests.find((r: any) => r._id.toString() === requestId);
    if (!rideRequest) {
      return NextResponse.json(
        { success: false, error: "Ride request not found." },
        { status: 404 }
      );
    }

    // Verify passenger authorization
    const isPassenger =
      (dbUser && rideRequest.passenger.toString() === dbUser._id.toString()) ||
      rideRequest.passenger.toString() === session.user.id;

    if (!isPassenger) {
      return NextResponse.json(
        { success: false, error: "Only the accepted passenger can broadcast their live GPS location." },
        { status: 403 }
      );
    }

    // Check ride state rules: Location sharing enabled ONLY when request is accepted and ride active
    if (rideRequest.status !== "accepted") {
      return NextResponse.json(
        { success: false, error: "Location sharing is only active for accepted ride bookings." },
        { status: 400 }
      );
    }

    if (ride.status === "completed" || ride.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Location sharing has ended for completed or cancelled rides." },
        { status: 400 }
      );
    }

    const currentLocation = {
      latitude,
      longitude,
      heading: heading || null,
      speed: speed || null,
      accuracy: accuracy || null,
      lastUpdated: new Date(),
    };

    // Update passenger live location embedded in Ride
    await Ride.updateOne(
      { _id: ride._id, "requests._id": requestId },
      { $set: { "requests.$.currentLocation": currentLocation } }
    );

    return NextResponse.json({
      success: true,
      currentLocation,
    });
  } catch (error: unknown) {
    console.error(" Passenger Live Location POST API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update passenger live GPS location." },
      { status: 500 }
    );
  }
}
