import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import { calculateRideCarbonEmissions } from "@/lib/services/carbonCalculation";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    rideId: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { rideId } = params;
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ride identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found." },
        { status: 404 }
      );
    }

    // Permission check: Driver of the ride or platform Admin
    const isDriver =
      ride.driver.toString() === session.user.id ||
      (session.user.email && (ride.driver as any).email === session.user.email);
    const isAdmin = session.user.role === "admin" || session.user.role === "campus_admin";

    if (!isDriver && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only the driver or an admin can trigger carbon calculation." },
        { status: 403 }
      );
    }

    if (ride.status !== "completed") {
      return NextResponse.json(
        { success: false, error: `Cannot calculate carbon for a ride in '${ride.status}' status. Ride must be completed.` },
        { status: 400 }
      );
    }

    const carbonRecord = await calculateRideCarbonEmissions(rideId);

    return NextResponse.json({
      success: true,
      message: "Carbon emissions calculated successfully.",
      carbonEmission: carbonRecord,
    });
  } catch (error: any) {
    console.error(" Carbon Calculate API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to calculate carbon emissions." },
      { status: 500 }
    );
  }
}
