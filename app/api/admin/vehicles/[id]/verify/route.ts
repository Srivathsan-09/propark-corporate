import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid vehicle identifier." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, rejectionReason, notes } = body;

    const validActions = ["approve", "reject", "manual_review", "reverify"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    if (action === "reject" && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json(
        { success: false, error: "A rejection reason is required when rejecting a vehicle." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const vehicle = await Vehicle.findById(id).populate("owner", "name employeeId email department campusId");
    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found." },
        { status: 404 }
      );
    }

    // Campus admin authorization check: only vehicles from same campus
    if (session.user.role === "campus_admin" && session.user.campusId) {
      const ownerCampus = (vehicle.owner as any)?.campusId;
      if (ownerCampus && ownerCampus.toLowerCase() !== session.user.campusId.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: "Access denied. You can only manage vehicles from your campus." },
          { status: 403 }
        );
      }
    }

    let updateData: Record<string, any> = {};

    if (action === "approve") {
      updateData = {
        commutexVehicleVerificationStatus: "VERIFIED",
        adminApprovalStatus: "APPROVED",
        finalDriverStatus: "VERIFIED",
        verificationStatus: "VERIFIED",
        isApproved: true,
        verifiedAt: new Date(),
        rejectionReason: "",
        verificationNotes: notes || "Approved by administrator.",
      };

      // Set user driver verification status to verified
      const User = (await import("@/models/User")).default;
      const ownerId = (vehicle.owner as any)?._id || vehicle.owner;
      await User.findByIdAndUpdate(ownerId, {
        $set: { driverVerificationStatus: "VERIFIED", isDriverApproved: true },
      });
    } else if (action === "reject") {
      updateData = {
        commutexVehicleVerificationStatus: "REJECTED",
        adminApprovalStatus: "REJECTED",
        finalDriverStatus: "REJECTED",
        verificationStatus: "REJECTED",
        isApproved: false,
        rejectionReason: rejectionReason.trim(),
        verificationNotes: notes || `Rejected by administrator: ${rejectionReason.trim()}`,
      };
    } else if (action === "manual_review") {
      updateData = {
        commutexVehicleVerificationStatus: "MANUAL_REVIEW",
        adminApprovalStatus: "PENDING",
        finalDriverStatus: "PENDING_ADMIN_REVIEW",
        verificationStatus: "MANUAL_REVIEW",
        vehicleMatchStatus: "MANUAL_REVIEW",
        isApproved: false,
        verificationNotes: notes || "Flagged for manual review by administrator.",
      };
    } else if (action === "reverify") {
      const { verifyDriverAndVehicle } = await import(
        "@/lib/services/driverVerificationService"
      );
      const { normalizeRegistrationNumber } = await import(
        "@/lib/services/vehicleVerification"
      );

      const normalizedPlate =
        vehicle.normalizedRegistrationNumber ||
        normalizeRegistrationNumber(vehicle.registrationNumber);

      const effectiveDl =
        vehicle.drivingLicenseNumber || (vehicle.owner as any)?.drivingLicenseNumber || "";
      const effectiveDob =
        vehicle.drivingLicenseDob || (vehicle.owner as any)?.drivingLicenseDob || "";

      const verificationResult = await verifyDriverAndVehicle(
        {
          registrationNumber: normalizedPlate,
          vehicleType: vehicle.vehicleType,
          make: vehicle.make || "",
          vehicleModel: vehicle.vehicleModel,
          color: vehicle.color || "",
          fuelType: vehicle.fuelType,
          seatingCapacity: vehicle.seatingCapacity,
          chassisNumber: vehicle.chassisNumber || "",
          engineNumber: vehicle.engineNumber || "",
          drivingLicenseNumber: effectiveDl,
          drivingLicenseDob: effectiveDob,
        },
        { bypassCache: true }
      );

      updateData = {
        normalizedRegistrationNumber: normalizedPlate,
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
        isApproved: false,
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
        verifiedRegistrationNumber:
          verificationResult.rcResult.verifiedRegistrationNumber || normalizedPlate,
        rcData: verificationResult.rcData || {},
      };
    }

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("owner", "name employeeId email department drivingLicenseNumber drivingLicenseDob");

    // Audit Log Admin Action
    try {
      const { logAdminActivity } = await import("@/lib/auditLogger");
      await logAdminActivity(req, session, {
        action: `DRIVER_VEHICLE_${action.toUpperCase()}`,
        targetEntity: "Vehicle",
        targetId: String(vehicle._id),
        targetName: `${vehicle.registrationNumber} (${vehicle.vehicleModel})`,
        details: `Administrator ${session.user.email} executed action '${action}' on vehicle ${vehicle.registrationNumber}. Final Status: ${updateData.finalDriverStatus || updatedVehicle?.finalDriverStatus || updatedVehicle?.verificationStatus}.`,
      });
    } catch (auditErr) {
      console.warn("Admin audit log warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? `Vehicle ${vehicle.registrationNumber} verified and approved for carpooling.`
          : action === "reject"
          ? `Vehicle ${vehicle.registrationNumber} status set to rejected.`
          : action === "manual_review"
          ? `Vehicle ${vehicle.registrationNumber} flagged for manual review.`
          : `Vehicle ${vehicle.registrationNumber} re-verification completed with status: ${updateData.verificationStatus}.`,
      vehicle: updatedVehicle,
    });
  } catch (error: unknown) {
    console.error("Vehicle verification API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update vehicle verification status." },
      { status: 500 }
    );
  }
}
