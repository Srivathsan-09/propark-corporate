import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import { vehicleSchema } from "@/validations/vehicle.schema";
import {
  normalizeRegistrationNumber,
  formatIndianPlateNumber,
  verifyVehicleWithWay2API,
} from "@/lib/services/vehicleVerification";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
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

    // Ensure vehicle exists AND belongs to the authenticated user
    const vehicle = await Vehicle.findOne({
      _id: id,
      owner: session.user.id,
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found or you do not have permission to view it." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      vehicle,
    });
  } catch (error: unknown) {
    console.error(" Vehicle GET by ID API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve vehicle details." },
      { status: 500 }
    );
  }
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

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid vehicle identifier format." },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Validate payload
    const validationResult = vehicleSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((e) => e.message);
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: errorMessages,
        },
        { status: 400 }
      );
    }

    const {
      vehicleType,
      make,
      color,
      fuelType,
      engineCapacity,
      vehicleModel,
      registrationNumber,
      seatingCapacity,
      availableSeats,
      vehiclePhoto,
      numberPlatePhoto,
      drivingLicensePhoto,
      status,
    } = validationResult.data;

    await connectToDatabase();

    const existingVehicle = await Vehicle.findOne({
      _id: id,
      owner: session.user.id,
    });

    if (!existingVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found or you are not authorized to edit this vehicle.",
        },
        { status: 404 }
      );
    }

    const normalizedPlate = normalizeRegistrationNumber(registrationNumber);
    const displayPlate = formatIndianPlateNumber(registrationNumber);

    // Check if another vehicle has the same registration plate
    const duplicateVehicle = await Vehicle.findOne({
      $or: [
        { normalizedRegistrationNumber: normalizedPlate },
        { registrationNumber: displayPlate },
        { registrationNumber: normalizedPlate },
      ],
      _id: { $ne: id },
    });

    if (duplicateVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: `Another vehicle with registration plate ${displayPlate} already exists.`,
        },
        { status: 409 }
      );
    }

    // Check if critical vehicle details changed
    const detailsChanged =
      existingVehicle.normalizedRegistrationNumber !== normalizedPlate ||
      existingVehicle.vehicleModel !== vehicleModel ||
      (existingVehicle.make || "") !== (make || "") ||
      existingVehicle.vehicleType !== vehicleType ||
      (existingVehicle.color || "") !== (color || "");

    const wasUnverified =
      existingVehicle.verificationStatus === "REJECTED" ||
      existingVehicle.verificationStatus === "rejected" ||
      existingVehicle.verificationStatus === "MANUAL_REVIEW" ||
      existingVehicle.verificationStatus === "VERIFICATION_FAILED";

    let verificationUpdate: Record<string, any> = {};

    // Re-verify if critical details changed or if correcting a previously unverified vehicle
    if (detailsChanged || wasUnverified) {
      const verificationResult = await verifyVehicleWithWay2API(
        {
          registrationNumber: normalizedPlate,
          vehicleType,
          make: make || "",
          vehicleModel,
          color: color || "",
          fuelType: fuelType || "Petrol",
          seatingCapacity,
        },
        { bypassCache: true }
      );

      verificationUpdate = {
        verificationStatus: verificationResult.status,
        isApproved: verificationResult.status === "VERIFIED",
        verificationProvider: verificationResult.provider,
        verificationReference: verificationResult.referenceId,
        verificationCheckedAt: verificationResult.checkedAt,
        verifiedAt: verificationResult.verifiedAt,
        verificationNotes: verificationResult.notes,
        rejectionReason: verificationResult.rejectionReason || "",
        rcData: verificationResult.rcData || {},
      };
    }

    // Update vehicle
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      {
        $set: {
          vehicleType,
          make: make || "",
          color: color || "",
          fuelType: fuelType || "Petrol",
          engineCapacity: engineCapacity || "",
          vehicleModel,
          registrationNumber: displayPlate,
          normalizedRegistrationNumber: normalizedPlate,
          seatingCapacity,
          availableSeats,
          vehiclePhoto: vehiclePhoto || "",
          numberPlatePhoto: numberPlatePhoto || "",
          drivingLicensePhoto: drivingLicensePhoto || "",
          status: status || "active",
          ...verificationUpdate,
        },
      },
      { new: true }
    );

    let message = "Vehicle updated successfully.";
    if (verificationUpdate.verificationStatus === "VERIFIED") {
      message = "Vehicle details updated and verified successfully!";
    } else if (verificationUpdate.verificationStatus === "MANUAL_REVIEW") {
      message = "Vehicle updated and submitted for admin review due to detail mismatch.";
    }

    return NextResponse.json({
      success: true,
      message,
      vehicle: updatedVehicle,
    });
  } catch (error: any) {
    console.error(" Vehicle PATCH API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update vehicle details." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
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

    // Delete ONLY if owner matches current authenticated user
    const deletedVehicle = await Vehicle.findOneAndDelete({
      _id: id,
      owner: session.user.id,
    });

    if (!deletedVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found or you are not authorized to delete this vehicle.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vehicle removed successfully.",
    });
  } catch (error: unknown) {
    console.error(" Vehicle DELETE API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete vehicle." },
      { status: 500 }
    );
  }
}
