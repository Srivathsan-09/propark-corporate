import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Notification from "@/models/Notification";
import { calculateRideCarbonEmissions } from "@/lib/services/carbonCalculation";
import { logEmployeeActivity } from "@/lib/services/activityLogger";

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

      logEmployeeActivity({
        employeeId: (ride.driver as any)._id || ride.driver,
        campusId: ride.campusId || "CAMP001",
        activityType: "RIDE_STARTED",
        entityType: "RIDE",
        entityId: ride._id.toString(),
        description: `Started ride from ${ride.startingLocation} to ${ride.destination}`,
        metadata: { status: "in_progress", origin: ride.startingLocation, destination: ride.destination },
      }).catch(() => {});
    } else if (status === "completed") {
      ride.completedAt = new Date();

      logEmployeeActivity({
        employeeId: (ride.driver as any)._id || ride.driver,
        campusId: ride.campusId || "CAMP001",
        activityType: "RIDE_COMPLETED",
        entityType: "RIDE",
        entityId: ride._id.toString(),
        description: `Completed ride from ${ride.startingLocation} to ${ride.destination} (${ride.distanceKm || 0} km)`,
        metadata: { status: "completed", distanceKm: ride.distanceKm, origin: ride.startingLocation, destination: ride.destination },
      }).catch(() => {});
    } else if (status === "cancelled") {
      ride.completedAt = new Date();
      ride.cancellation = {
        cancelledBy: new mongoose.Types.ObjectId(session.user.id),
        cancelledByRole: session.user.role === "admin" ? "admin" : "driver",
        cancelledAt: new Date(),
        reason: body.reason || "Cancelled by driver",
        previousStatus,
      };

      logEmployeeActivity({
        employeeId: (ride.driver as any)._id || ride.driver,
        campusId: ride.campusId || "CAMP001",
        activityType: "RIDE_CANCELLED",
        entityType: "RIDE",
        entityId: ride._id.toString(),
        description: `Cancelled ride from ${ride.startingLocation} to ${ride.destination}`,
        metadata: { status: "cancelled", reason: body.reason || "Cancelled by driver" },
      }).catch(() => {});
    }

    await ride.save();

    // Trigger research-grade carbon emission calculation if ride completed
    if (status === "completed") {
      calculateRideCarbonEmissions(ride._id.toString()).catch((err) =>
        console.warn(" Background carbon emission calculation error:", err)
      );
    }

    // Broadcast in-app notifications asynchronously in background for sub-50ms API response time
    const acceptedRequests = (ride.requests || []).filter((r: any) => r.status === "accepted");

    if (acceptedRequests.length > 0) {
      const driverName = (ride.driver as any).name || session.user.name || "Your driver";

      if (status === "in_progress") {
        Promise.all(
          acceptedRequests.map((reqItem: any) =>
            Notification.create({
              recipient: reqItem.passenger,
              sender: (ride.driver as any)._id || ride.driver,
              title: "Ride Started - Live GPS Active",
              message: `Employee ${driverName} has started the ride. You can now track their live GPS location in real time!`,
              type: "ride_started",
              ride: ride._id,
            })
          )
        ).catch((err) => console.warn("Background notification error:", err));
      } else if (status === "completed") {
        Promise.all(
          acceptedRequests.map((reqItem: any) =>
            Notification.create({
              recipient: reqItem.passenger,
              sender: (ride.driver as any)._id || ride.driver,
              title: "Ride Completed",
              message: `You have reached your destination. Thank you for carpooling with Employee ${driverName} on CommuteX.`,
              type: "ride_completed",
              ride: ride._id,
            })
          )
        ).catch((err) => console.warn("Background notification error:", err));
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
