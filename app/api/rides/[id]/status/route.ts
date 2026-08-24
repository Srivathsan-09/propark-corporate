import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Notification from "@/models/Notification";
import RideRequest from "@/models/RideRequest";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    const body = await req.json();
    const { status, initialLocation } = body;

    if (!["scheduled", "in_progress", "completed", "cancelled"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value." },
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
        { success: false, error: "Only the driver can update the ride status." },
        { status: 403 }
      );
    }

    const previousStatus = ride.status;
    ride.status = status;

    if (status === "in_progress" && previousStatus !== "in_progress") {
      ride.startedAt = new Date();
      if (initialLocation && initialLocation.latitude && initialLocation.longitude) {
        ride.currentLocation = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          heading: initialLocation.heading || null,
          speed: initialLocation.speed || null,
          accuracy: initialLocation.accuracy || null,
          lastUpdated: new Date(),
        };
      }
    } else if (status === "completed" || status === "cancelled") {
      ride.completedAt = new Date();
    }

    await ride.save();

    // Broadcast in-app notifications to all accepted passengers
    const acceptedRequests = await RideRequest.find({
      ride: ride._id,
      status: "accepted",
    });

    if (acceptedRequests.length > 0) {
      const driverName = (ride.driver as any).name || session.user.name || "Your driver";

      if (status === "in_progress") {
        await Promise.all(
          acceptedRequests.map((req) =>
            Notification.create({
              recipient: req.passenger,
              sender: ride.driver._id,
              title: "Ride Started - Live GPS Active",
              message: `Employee ${driverName} has started the ride. You can now track their live GPS location in real time!`,
              type: "ride_started",
              ride: ride._id,
              rideRequest: req._id,
            })
          )
        );
      } else if (status === "completed") {
        await Promise.all(
          acceptedRequests.map((req) =>
            Notification.create({
              recipient: req.passenger,
              sender: ride.driver._id,
              title: "Ride Completed",
              message: `You have reached your destination. Thank you for carpooling with Employee ${driverName} on CommuteX.`,
              type: "ride_completed",
              ride: ride._id,
              rideRequest: req._id,
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        status === "in_progress"
          ? "Ride started! Live GPS tracking is now broadcasting."
          : `Ride status updated to ${status}.`,
      ride,
    });
  } catch (error: unknown) {
    console.error(" Update Ride Status API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ride status." },
      { status: 500 }
    );
  }
}
