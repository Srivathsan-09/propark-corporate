import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import {
  normalizeRegistrationNumber,
  verifyVehicleWithWay2API,
} from "@/lib/services/vehicleVerification";

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
        { success: false, error: "Unauthorized. Please login to verify vehicle." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid vehicle identifier format." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found." },
        { status: 404 }
      );
    }

    // Role check: Only vehicle owner or admin can request verification
    const isOwner = vehicle.owner.toString() === session.user.id;
    const isAdmin = session.user.role === "admin" || session.user.role === "campus_admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to verify this vehicle." },
        { status: 403 }
      );
    }

    const normalizedPlate =
      vehicle.normalizedRegistrationNumber ||
      normalizeRegistrationNumber(vehicle.registrationNumber);

    // Call Way2API Verification Service (bypass cache for explicit user verification trigger)
    const verificationResult = await verifyVehicleWithWay2API(
      {
        registrationNumber: normalizedPlate,
        vehicleType: vehicle.vehicleType,
        make: vehicle.make || "",
        vehicleModel: vehicle.vehicleModel,
        color: vehicle.color || "",
        fuelType: vehicle.fuelType,
        seatingCapacity: vehicle.seatingCapacity,
      },
      { bypassCache: true }
    );

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      {
        $set: {
          normalizedRegistrationNumber: normalizedPlate,
          verificationStatus: verificationResult.status,
          isApproved: verificationResult.status === "VERIFIED",
          verificationProvider: verificationResult.provider,
          verificationReference: verificationResult.referenceId,
          verificationCheckedAt: verificationResult.checkedAt,
          verifiedAt: verificationResult.verifiedAt,
          verificationNotes: verificationResult.notes,
          rejectionReason: verificationResult.rejectionReason || "",
          rcData: verificationResult.rcData || {},
        },
      },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message:
        verificationResult.status === "VERIFIED"
          ? "Vehicle successfully verified with official RC registry!"
          : verificationResult.status === "MANUAL_REVIEW"
          ? "Vehicle details flagged for administrator review."
          : verificationResult.status === "VERIFICATION_FAILED"
          ? "Verification service is temporarily unavailable. Please try again later."
          : "Verification processed.",
      verificationStatus: verificationResult.status,
      vehicle: updatedVehicle,
    });
  } catch (error: unknown) {
    console.error("Vehicle verification trigger error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process vehicle verification." },
      { status: 500 }
    );
  }
}
