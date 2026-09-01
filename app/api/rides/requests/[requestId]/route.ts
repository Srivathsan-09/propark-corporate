import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import User from "@/models/User";
import Notification from "@/models/Notification";

interface RouteParams {
  params: {
    requestId: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { requestId } = params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json(
        { success: false, error: "Invalid request identifier format." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, responseNote } = body;

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'accept' or 'reject'." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ride = await Ride.findOne({ "requests._id": requestId })
      .populate("requests.passenger", "name email phone companyName")
      .populate("requests.driver", "name email phone companyName");

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

    // Verify session user is indeed the driver
    const driverIdStr = rideRequest.driver?._id ? rideRequest.driver._id.toString() : rideRequest.driver?.toString();
    if (driverIdStr !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the driver of this ride can accept or reject requests." },
        { status: 403 }
      );
    }

    if (rideRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `This request has already been ${rideRequest.status}.` },
        { status: 400 }
      );
    }

    const passengerId = rideRequest.passenger?._id || rideRequest.passenger;

    if (action === "accept") {
      if (ride.availableSeats < rideRequest.seatsRequested) {
        return NextResponse.json(
          {
            success: false,
            error: `Not enough available seats left (Remaining: ${ride.availableSeats}, Requested: ${rideRequest.seatsRequested}).`,
          },
          { status: 400 }
        );
      }

      // Generate 4-digit boarding security PIN
      const boardingPin = String(Math.floor(1000 + Math.random() * 9000));

      await Ride.updateOne(
        { _id: ride._id, "requests._id": requestId },
        {
          $set: {
            "requests.$.status": "accepted",
            "requests.$.boardingPin": boardingPin,
            "requests.$.responseNote": responseNote || "Request accepted by driver",
          },
          $inc: { availableSeats: -rideRequest.seatsRequested },
          $addToSet: { acceptedPassengers: passengerId },
        }
      );

      rideRequest.status = "accepted";
      rideRequest.boardingPin = boardingPin;

      // Notify Passenger
      await Notification.create({
        recipient: passengerId,
        sender: session.user.id,
        title: "Ride Request Confirmed",
        message: `${session.user.name} accepted your carpool request. Your 4-digit Boarding PIN is: ${boardingPin}. Share this with the driver upon entering the car.`,
        type: "request_accepted",
        ride: ride._id,
      });

      return NextResponse.json({
        success: true,
        message: `Accepted ride request from ${(rideRequest.passenger as any)?.name || "passenger"}!`,
        request: rideRequest,
        remainingSeats: Math.max(0, ride.availableSeats - rideRequest.seatsRequested),
      });
    } else {
      // Reject flow
      await Ride.updateOne(
        { _id: ride._id, "requests._id": requestId },
        {
          $set: {
            "requests.$.status": "rejected",
            "requests.$.responseNote": responseNote || "Declined by driver",
          },
        }
      );

      rideRequest.status = "rejected";

      // Notify Passenger
      await Notification.create({
        recipient: passengerId,
        sender: session.user.id,
        title: "Ride Request Update",
        message: `${session.user.name} was unable to accept your carpool request from "${rideRequest.pickupStop}".`,
        type: "request_rejected",
        ride: ride._id,
      });

      return NextResponse.json({
        success: true,
        message: `Declined ride request from ${(rideRequest.passenger as any)?.name || "passenger"}.`,
        request: rideRequest,
      });
    }
  } catch (error: unknown) {
    console.error(" Accept/Reject Request API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ride request status." },
      { status: 500 }
    );
  }
}
