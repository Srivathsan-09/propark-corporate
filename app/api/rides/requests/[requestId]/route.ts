import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";
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

    const rideRequest = await RideRequest.findById(requestId)
      .populate("ride")
      .populate("passenger", "name email phone companyName")
      .populate("driver", "name email phone companyName");

    if (!rideRequest) {
      return NextResponse.json(
        { success: false, error: "Ride request not found." },
        { status: 404 }
      );
    }

    // Verify session user is indeed the driver
    if (rideRequest.driver._id.toString() !== session.user.id) {
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

    const ride = await Ride.findById(rideRequest.ride._id);
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Associated ride was not found." },
        { status: 404 }
      );
    }

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

      // Deduct available seats and add passenger to accepted list
      ride.availableSeats -= rideRequest.seatsRequested;
      ride.acceptedPassengers.push(rideRequest.passenger._id);
      await ride.save();

      // Generate 4-digit boarding security PIN
      const boardingPin = String(Math.floor(1000 + Math.random() * 9000));

      rideRequest.status = "accepted";
      rideRequest.boardingPin = boardingPin;
      rideRequest.responseNote = responseNote || "Request accepted by driver";
      await rideRequest.save();

      // Notify Passenger
      await Notification.create({
        recipient: rideRequest.passenger._id,
        sender: session.user.id,
        title: "Ride Request Confirmed",
        message: `${session.user.name} accepted your carpool request. Your 4-digit Boarding PIN is: ${boardingPin}. Share this with the driver upon entering the car.`,
        type: "request_accepted",
        ride: ride._id,
        rideRequest: rideRequest._id,
      });

      return NextResponse.json({
        success: true,
        message: `Accepted ride request from ${(rideRequest.passenger as any)?.name || "passenger"}!`,
        request: rideRequest,
        remainingSeats: ride.availableSeats,
      });
    } else {
      // Reject flow
      rideRequest.status = "rejected";
      rideRequest.responseNote = responseNote || "Declined by driver";
      await rideRequest.save();

      // Notify Passenger
      await Notification.create({
        recipient: (rideRequest.passenger as any)._id || rideRequest.passenger,
        sender: session.user.id,
        title: "Ride Request Update",
        message: `${session.user.name} was unable to accept your carpool request from "${rideRequest.pickupStop}".`,
        type: "request_rejected",
        ride: ride._id,
        rideRequest: rideRequest._id,
      });

      return NextResponse.json({
        success: true,
        message: `Declined ride request from ${(rideRequest.passenger as any)?.name || "passenger"}.`,
        request: rideRequest,
      });
    }
  } catch (error: unknown) {
    console.error("❌ Accept/Reject Request API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ride request status." },
      { status: 500 }
    );
  }
}
