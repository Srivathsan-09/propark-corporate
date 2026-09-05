import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User";
import { vehicleSchema } from "@/validations/vehicle.schema";
import {
  normalizeRegistrationNumber,
  formatIndianPlateNumber,
} from "@/lib/services/vehicleVerification";
import { verifyDriverAndVehicle } from "@/lib/services/driverVerificationService";

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
      drivingLicenseNumber,
      drivingLicenseDob,
      chassisNumber,
      engineNumber,
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

    // Retrieve user for fallback DL details if not provided in form
    const userDoc = await User.findById(session.user.id);
    const effectiveDlNumber = (
      drivingLicenseNumber ||
      existingVehicle.drivingLicenseNumber ||
      userDoc?.drivingLicenseNumber ||
      ""
    ).trim().toUpperCase();
    const effectiveDob =
      drivingLicenseDob || existingVehicle.drivingLicenseDob || userDoc?.drivingLicenseDob || "";

    // Check if critical vehicle or licence details changed
    const detailsChanged =
      existingVehicle.normalizedRegistrationNumber !== normalizedPlate ||
      existingVehicle.vehicleModel !== vehicleModel ||
      (existingVehicle.make || "") !== (make || "") ||
      existingVehicle.vehicleType !== vehicleType ||
      (existingVehicle.color || "") !== (color || "") ||
      (existingVehicle.drivingLicenseNumber || "") !== effectiveDlNumber ||
      (existingVehicle.drivingLicenseDob || "") !== effectiveDob;

    const wasUnverified =
      existingVehicle.finalDriverStatus === "REJECTED" ||
      existingVehicle.verificationStatus === "REJECTED" ||
      existingVehicle.verificationStatus === "rejected" ||
      existingVehicle.verificationStatus === "MANUAL_REVIEW" ||
      existingVehicle.verificationStatus === "VERIFICATION_FAILED";

    let verificationUpdate: Record<string, any> = {};

    // Re-verify if critical details changed or if correcting a previously unverified vehicle
    if (detailsChanged || wasUnverified) {
      const verificationResult = await verifyDriverAndVehicle(
        {
          registrationNumber: normalizedPlate,
          vehicleType,
          make: make || "",
          vehicleModel,
          color: color || "",
          fuelType: fuelType || "Petrol",
          seatingCapacity,
          chassisNumber: chassisNumber || existingVehicle.chassisNumber || "",
          engineNumber: engineNumber || existingVehicle.engineNumber || "",
          drivingLicenseNumber: effectiveDlNumber,
          drivingLicenseDob: effectiveDob,
        },
        { bypassCache: true }
      );

      verificationUpdate = {
        drivingLicenseNumber: effectiveDlNumber,
        drivingLicenseDob: effectiveDob,
        chassisNumber: chassisNumber || existingVehicle.chassisNumber || "",
        engineNumber: engineNumber || existingVehicle.engineNumber || "",
        drivingLicenseStatus: verificationResult.drivingLicenseStatus,
        drivingLicenseVerifiedAt: verificationResult.dlResult.verifiedAt,
        drivingLicenseMessageCode: verificationResult.dlResult.messageCode,
        drivingLicenseOrderId: verificationResult.dlResult.orderId,
        drivingLicenseClasses: verificationResult.dlResult.vehicleClasses,
        drivingLicenseData: verificationResult.dlData || {},
        rcProviderStatus: verificationResult.rcProviderStatus,
        rcStatus: verificationResult.rcStatus,
        rcVerifiedAt: verificationResult.rcResult.verifiedAt,
        rcMessageCode: verificationResult.rcResult.messageCode,
        rcOrderId: verificationResult.rcResult.orderId,
        vehicleMatchStatus: verificationResult.vehicleMatchStatus,
        licenseVehicleClassStatus: verificationResult.licenseVehicleClassStatus,
        commutexVehicleVerificationStatus: verificationResult.commutexVehicleVerificationStatus,
        adminApprovalStatus: "PENDING",
        finalDriverStatus: verificationResult.finalDriverStatus,
        verificationStatus: verificationResult.commutexVehicleVerificationStatus === "VERIFIED" ? "VERIFIED" : verificationResult.commutexVehicleVerificationStatus === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "REJECTED",
        isApproved: false, // Re-submits for admin review; does not auto-approve
        verificationProvider: "way2api",
        verificationReference:
          verificationResult.rcResult.orderId || verificationResult.dlResult.orderId || "",
        verificationCheckedAt: verificationResult.checkedAt,
        verificationNotes: verificationResult.summaryNotes,
        rejectionReason: verificationResult.rejectionReason || "",
        verifiedMaker: verificationResult.rcResult.verifiedMaker || "",
        verifiedModel: verificationResult.rcResult.verifiedModel || "",
        verifiedCategory: verificationResult.rcResult.verifiedCategory || "",
        verifiedBodyType: verificationResult.rcResult.verifiedBodyType || "",
        verifiedRCStatus: verificationResult.rcResult.verifiedRCStatus || "",
        verifiedCapacity: verificationResult.rcResult.verifiedCapacity || "",
        verifiedRegistrationNumber: verificationResult.rcResult.verifiedRegistrationNumber || normalizedPlate,
        rcData: verificationResult.rcData || {},
      };

      if (userDoc && effectiveDlNumber) {
        userDoc.drivingLicenseNumber = effectiveDlNumber;
        if (effectiveDob) userDoc.drivingLicenseDob = effectiveDob;
        await userDoc.save();
      }
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
    if (verificationUpdate.finalDriverStatus === "PENDING_ADMIN_REVIEW") {
      message = "Vehicle details updated and verified with Way2API registry! Submitted for admin approval.";
    } else if (verificationUpdate.finalDriverStatus === "REJECTED") {
      message = verificationUpdate.rejectionReason || "Vehicle details updated but failed verification checks.";
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
