import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { rideRequestSchema } from "@/validations/ride.schema";
import { workerPool } from "@/lib/concurrency/WorkerPool";

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

    const { id: rideId } = params;
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
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

    // Idempotency key from header or body
    const idempotencyKey =
      req.headers.get("x-idempotency-key") ||
      (body.idempotencyKey as string) ||
      `IDEM-${rideId}-${session.user.id}-${Date.now()}`;

    // PROCESS REQUEST THROUGH HIGH-CONCURRENCY PIPELINE
    // Load Balancer -> Ride-Scoped FIFO Queue -> Concurrent Workers -> Atomic MongoDB Transaction
    const result = await workerPool.processRequest(rideId, {
      userId: session.user.id,
      userName: passenger.name,
      userEmail: passenger.email,
      userCampusId: passenger.campusId || (session.user as any).campusId || "CAMP001",
      pickupStop,
      dropStop: dropStop || "Destination",
      seatsRequested: seatsRequested || 1,
      fare: fare || 0,
      notes: notes || "",
      currentLocation: body.currentLocation || body.passengerLocation || null,
      idempotencyKey,
    });

    const statusCode = result.success ? (result.idempotencyHit ? 200 : 201) : 400;

    const response = NextResponse.json(result, { status: statusCode });
    response.headers.set("x-server-node", result.processedByNode || "Server 1");
    response.headers.set("x-load-balanced-by", "Round-Robin");
    response.headers.set("x-idempotency-key", idempotencyKey);

    return response;
  } catch (error: unknown) {
    console.error("High-Concurrency Ride Request API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process ride booking request. Please try again." },
      { status: 500 }
    );
  }
}
