import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Notification from "@/models/Notification";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
        { success: false, error: "Forbidden. You can only delete your own offered rides." },
        { status: 403 }
      );
    }

    // 1. Find all passenger requests for this ride embedded in Ride document
    const requests = ride.requests || [];

    // 2. Notify all passengers who requested or were accepted
    const notificationPromises = requests.map(async (reqItem: any) => {
      try {
        await Notification.create({
          recipient: reqItem.passenger,
          title: "Ride Cancelled & Deleted",
          message: `The ride from ${ride.startingLocation} to ${ride.destination} scheduled for ${ride.departureDate} at ${ride.departureTime} has been cancelled and deleted by the driver.`,
          type: "ride_request",
          link: "/rides/find",
        });
      } catch (err) {
        console.warn("Failed to send ride deletion notification:", err);
      }
    });

    await Promise.all(notificationPromises);

    // 3. Delete the ride itself
    await Ride.findByIdAndDelete(ride._id);

    return NextResponse.json({
      success: true,
      message: "Ride deleted successfully.",
    });
  } catch (error: any) {
    console.error("Delete ride error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete ride." },
      { status: 500 }
    );
  }
}
