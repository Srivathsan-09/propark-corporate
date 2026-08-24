import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { rideRequestSchema } from "@/validations/ride.schema";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to request a ride." },
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

    // Check user approval
    const passenger = await User.findById(session.user.id);
    if (!passenger || (!passenger.isApproved && passenger.role !== "admin")) {
      return NextResponse.json(
        {
          success: false,
          error: "Your employee profile is awaiting campus verification before you can book rides.",
        },
        { status: 403 }
      );
    }

    // Check ride
    const ride = await Ride.findById(id).populate("driver", "name email phone companyName");
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found or no longer available." },
        { status: 404 }
      );
    }

    if (ride.driver._id.toString() === session.user.id) {
      return NextResponse.json(
        { success: false, error: "You cannot request a seat on a ride you are driving." },
        { status: 400 }
      );
    }

    if (ride.status !== "scheduled") {
      return NextResponse.json(
        { success: false, error: `This ride is ${ride.status} and cannot accept new bookings.` },
        { status: 400 }
      );
    }

    if (ride.availableSeats <= 0) {
      return NextResponse.json(
        { success: false, error: "This ride is fully booked. No seats remaining." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validationResult = rideRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((e) => e.message);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errorMessages },
        { status: 400 }
      );
    }

    const { pickupStop, dropStop, seatsRequested, fare, notes } = validationResult.data;

    if (seatsRequested > ride.availableSeats) {
      return NextResponse.json(
        {
          success: false,
          error: `Requested seats (${seatsRequested}) exceed available seats (${ride.availableSeats}).`,
        },
        { status: 400 }
      );
    }

    // Check existing request
    const existingRequest = await RideRequest.findOne({
      ride: ride._id,
      passenger: session.user.id,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          success: false,
          error: `You already have a ${existingRequest.status} booking request for this ride.`,
        },
        { status: 409 }
      );
    }

    // Create ride request
    const newRequest = await RideRequest.create({
      ride: ride._id,
      passenger: session.user.id,
      driver: ride.driver._id,
      pickupStop,
      dropStop: dropStop || ride.destination,
      seatsRequested,
      fare,
      notes: notes || "",
      status: "pending",
    });

    // Send notification to the driver
    await Notification.create({
      recipient: ride.driver._id,
      sender: session.user.id,
      title: "New Ride Request Received",
      message: `${passenger.name} (${passenger.companyName || "Employee"}) requested ${seatsRequested} seat(s) from "${pickupStop}" (Est. Fare: ₹${fare}).`,
      type: "ride_requested",
      ride: ride._id,
      rideRequest: newRequest._id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ride request sent to driver! You will be notified once they accept or reject.",
        request: newRequest,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(" Ride Request API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit ride request. Please try again." },
      { status: 500 }
    );
  }
}
