import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Notification from "@/models/Notification";
import CarbonEmission from "@/models/CarbonEmission";
import { logEmployeeActivity } from "@/lib/services/activityLogger";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET: Fetch single ride details for Admin
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "campus_admin")
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
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
      .populate("driver", "name email employeeId department companyName campusId phone profileImage")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber seatingCapacity")
      .populate("acceptedPassengers", "name email employeeId department companyName phone profileImage")
      .populate("requests.passenger", "name email employeeId department companyName phone profileImage")
      .lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ride,
    });
  } catch (error: any) {
    console.error("Admin fetch ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch ride." },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Admin permanently cancels & deletes a ride
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "campus_admin")
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
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
      .populate("driver", "name email employeeId phone companyName")
      .lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found or already deleted." },
        { status: 404 }
      );
    }

    const driverUser = ride.driver as any;
    const driverName = driverUser?.name || "Driver";
    const driverId = driverUser?._id || ride.driver;
    const adminIdentifier = session.user.name || session.user.email || "Campus Admin";

    // 1. Notify all passengers who requested or were accepted for this ride
    const requests = ride.requests || [];
    const notificationPromises = requests.map(async (reqItem: any) => {
      try {
        const passengerId = reqItem.passenger?._id || reqItem.passenger;
        if (!passengerId) return;

        await Notification.create({
          recipient: passengerId,
          title: "Ride Cancelled & Removed",
          message: `The scheduled ride from ${ride.startingLocation} to ${ride.destination} on ${ride.departureDate} at ${ride.departureTime} has been cancelled and removed by campus administration.`,
          type: "ride_request",
          link: "/rides/find",
        });
      } catch (err) {
        console.warn("Failed to notify passenger of admin ride deletion:", err);
      }
    });

    await Promise.allSettled(notificationPromises);

    // 2. Notify the driver that the ride was removed by campus administration
    if (driverId) {
      try {
        await Notification.create({
          recipient: driverId,
          title: "Ride Removed by Admin",
          message: `Your ride offering from ${ride.startingLocation} to ${ride.destination} scheduled for ${ride.departureDate} at ${ride.departureTime} was removed by campus administration (${adminIdentifier}).`,
          type: "ride_request",
          link: "/rides/my-rides",
        });
      } catch (err) {
        console.warn("Failed to notify driver of admin ride deletion:", err);
      }
    }

    // 3. Clean up associated CarbonEmission records
    try {
      await CarbonEmission.deleteMany({ rideId: ride._id });
    } catch (e) {
      console.warn("Failed to clean up carbon emission on admin ride deletion:", e);
    }

    // 4. Permanently delete the ride document
    await Ride.findByIdAndDelete(id);

    // 5. Audit log RIDE_DELETED activity
    try {
      await logEmployeeActivity({
        employeeId: session.user.id || driverId,
        campusId: ride.campusId || session.user.campusId || "CAMP001",
        activityType: "RIDE_DELETED",
        entityType: "RIDE",
        entityId: id,
        description: `Administrator ${adminIdentifier} deleted ride #${id.slice(-6).toUpperCase()} (${ride.startingLocation} -> ${ride.destination})`,
        metadata: {
          deletedBy: session.user.email,
          adminRole: session.user.role,
          driverName,
          driverEmail: driverUser?.email,
          startingLocation: ride.startingLocation,
          destination: ride.destination,
          departureDate: ride.departureDate,
          departureTime: ride.departureTime,
          previousStatus: ride.status,
          requestsCount: requests.length,
          totalFareGenerated: requests
            .filter((r: any) => r.status === "accepted")
            .reduce((acc: number, curr: any) => acc + (curr.fare || 0), 0),
        },
      });
    } catch (auditErr) {
      console.warn("Failed to log ride deletion activity:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Ride from ${ride.startingLocation} to ${ride.destination} successfully deleted.`,
    });
  } catch (error: any) {
    console.error("Admin delete ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete ride." },
      { status: 500 }
    );
  }
}
