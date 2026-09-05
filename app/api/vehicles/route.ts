import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User";

export const dynamic = "force-dynamic";
import { vehicleSchema } from "@/validations/vehicle.schema";
import {
  normalizeRegistrationNumber,
  formatIndianPlateNumber,
} from "@/lib/services/vehicleVerification";
import { verifyDriverAndVehicle } from "@/lib/services/driverVerificationService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to view vehicles." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Query ONLY vehicles belonging to the currently authenticated user
    const vehicles = await Vehicle.find({ owner: session.user.id }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      vehicles,
    });
  } catch (error: unknown) {
    console.error(" Vehicle GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve vehicles." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to add a vehicle." },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate request data with Zod
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

    const normalizedPlate = normalizeRegistrationNumber(registrationNumber);
    const displayPlate = formatIndianPlateNumber(registrationNumber);

    // Check if plate already registered in platform (by normalized or raw number)
    const existingVehicle = await Vehicle.findOne({
      $or: [
        { normalizedRegistrationNumber: normalizedPlate },
        { registrationNumber: displayPlate },
        { registrationNumber: normalizedPlate },
      ],
    });

    if (existingVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: `Vehicle plate ${displayPlate} is already registered on the platform.`,
        },
        { status: 409 }
      );
    }

    // Retrieve user for fallback DL details if not entered in vehicle form
    const userDoc = await User.findById(session.user.id);
    const effectiveDlNumber = (drivingLicenseNumber || userDoc?.drivingLicenseNumber || "").trim().toUpperCase();
    const effectiveDob = drivingLicenseDob || userDoc?.drivingLicenseDob || "";

    // Call Driver & Vehicle Dual Verification service
    const verificationResult = await verifyDriverAndVehicle({
      registrationNumber: normalizedPlate,
      vehicleType,
      make: make || "",
      vehicleModel,
      color: color || "",
      fuelType: fuelType || "Petrol",
      seatingCapacity,
      chassisNumber: chassisNumber || "",
      engineNumber: engineNumber || "",
      drivingLicenseNumber: effectiveDlNumber,
      drivingLicenseDob: effectiveDob,
    });

    // Create vehicle strictly owned by the authenticated session user
    const newVehicle = await Vehicle.create({
      owner: session.user.id,
      vehicleType,
      make: make || "",
      fuelType: fuelType || "Petrol",
      engineCapacity: engineCapacity || "",
      vehicleModel,
      color: color || "",
      registrationNumber: displayPlate,
      normalizedRegistrationNumber: normalizedPlate,
      seatingCapacity,
      availableSeats,
      vehiclePhoto: vehiclePhoto || "",
      numberPlatePhoto: numberPlatePhoto || "",
      drivingLicensePhoto: drivingLicensePhoto || "",
      drivingLicenseNumber: effectiveDlNumber,
      drivingLicenseDob: effectiveDob,
      chassisNumber: chassisNumber || "",
      engineNumber: engineNumber || "",
      drivingLicenseStatus: verificationResult.drivingLicenseStatus,
      drivingLicenseVerifiedAt: verificationResult.dlResult.verifiedAt,
      drivingLicenseMessageCode: verificationResult.dlResult.messageCode,
      drivingLicenseOrderId: verificationResult.dlResult.orderId,
      drivingLicenseClasses: verificationResult.dlResult.vehicleClasses,
      drivingLicenseData: verificationResult.dlData || {},
      rcStatus: verificationResult.rcStatus,
      rcVerifiedAt: verificationResult.rcResult.verifiedAt,
      rcMessageCode: verificationResult.rcResult.messageCode,
      rcOrderId: verificationResult.rcResult.orderId,
      vehicleMatchStatus: verificationResult.vehicleMatchStatus,
      finalDriverStatus: verificationResult.finalDriverStatus,
      verificationStatus: verificationResult.rcResult.status,
      isApproved: false, // Per CommuteX rules: Requires Super Admin / Campus Admin approval
      verificationProvider: "way2api",
      verificationReference: verificationResult.rcResult.orderId || verificationResult.dlResult.orderId || "",
      verificationCheckedAt: verificationResult.checkedAt,
      verificationNotes: verificationResult.summaryNotes,
      rejectionReason: verificationResult.rejectionReason || "",
      rcData: verificationResult.rcData || {},
      status: status || "active",
    });

    // Update user profile with DL details if successfully verified
    if (userDoc && effectiveDlNumber) {
      userDoc.drivingLicenseNumber = effectiveDlNumber;
      if (effectiveDob) userDoc.drivingLicenseDob = effectiveDob;
      if (userDoc.driverVerificationStatus !== "VERIFIED") {
        userDoc.driverVerificationStatus = verificationResult.finalDriverStatus;
      }
      await userDoc.save();
    }

    // Audit Log for Verification
    try {
      const { logAdminActivity } = await import("@/lib/auditLogger");
      await logAdminActivity(req, session, {
        action: "DRIVER_AND_VEHICLE_SUBMITTED",
        targetEntity: "Vehicle",
        targetId: String(newVehicle._id),
        targetName: `${displayPlate} (${vehicleModel})`,
        details: `Driver & Vehicle verification submitted: DL=${verificationResult.drivingLicenseStatus}, RC=${verificationResult.rcStatus}, VehicleMatch=${verificationResult.vehicleMatchStatus}, FinalStatus=${verificationResult.finalDriverStatus}.`,
      });
    } catch (auditErr) {
      console.warn("Audit logging warning:", auditErr);
    }

    let responseMessage = "Vehicle registered! Verification evidence collected and submitted for admin review.";
    if (verificationResult.finalDriverStatus === "REJECTED") {
      responseMessage = verificationResult.rejectionReason || "Vehicle or licence details failed validation.";
    } else if (verificationResult.finalDriverStatus === "PENDING_ADMIN_REVIEW") {
      responseMessage = "Vehicle and licence verified with Way2API registry and submitted for administrator approval.";
    }

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        verificationStatus: verificationResult.finalDriverStatus,
        drivingLicenseStatus: verificationResult.drivingLicenseStatus,
        rcStatus: verificationResult.rcStatus,
        vehicleMatchStatus: verificationResult.vehicleMatchStatus,
        finalDriverStatus: verificationResult.finalDriverStatus,
        vehicle: newVehicle,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(" Vehicle POST API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to register vehicle. Please try again." },
      { status: 500 }
    );
  }
}
