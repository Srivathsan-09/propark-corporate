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
        verificationStatus: "VERIFIED",
        isApproved: true,
        verifiedAt: new Date(),
        rejectionReason: "",
        verificationNotes: notes || "Approved by administrator.",
      };
    } else if (action === "reject") {
      updateData = {
        verificationStatus: "REJECTED",
        isApproved: false,
        rejectionReason: rejectionReason.trim(),
        verificationNotes: notes || `Rejected by administrator: ${rejectionReason.trim()}`,
      };
    } else if (action === "manual_review") {
      updateData = {
        verificationStatus: "MANUAL_REVIEW",
        isApproved: false,
        verificationNotes: notes || "Flagged for manual review by administrator.",
      };
    } else if (action === "reverify") {
      const { normalizeRegistrationNumber, verifyVehicleWithWay2API } = await import(
        "@/lib/services/vehicleVerification"
      );

      const normalizedPlate =
        vehicle.normalizedRegistrationNumber ||
        normalizeRegistrationNumber(vehicle.registrationNumber);

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

      updateData = {
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
      };
    }

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("owner", "name employeeId email department");

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
