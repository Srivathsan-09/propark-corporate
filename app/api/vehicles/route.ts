import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";

export const dynamic = "force-dynamic";
import { vehicleSchema } from "@/validations/vehicle.schema";
import {
  normalizeRegistrationNumber,
  formatIndianPlateNumber,
  verifyVehicleWithWay2API,
} from "@/lib/services/vehicleVerification";

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

    // Call Way2API Vehicle RC Verification service
    const verificationResult = await verifyVehicleWithWay2API({
      registrationNumber: normalizedPlate,
      vehicleType,
      make: make || "",
      vehicleModel,
      color: color || "",
      fuelType: fuelType || "Petrol",
      seatingCapacity,
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
      verificationStatus: verificationResult.status,
      isApproved: verificationResult.status === "VERIFIED",
      verificationProvider: verificationResult.provider,
      verificationReference: verificationResult.referenceId,
      verificationCheckedAt: verificationResult.checkedAt,
      verifiedAt: verificationResult.verifiedAt,
      verificationNotes: verificationResult.notes,
      rejectionReason: verificationResult.rejectionReason || "",
      rcData: verificationResult.rcData || {},
      status: status || "active",
    });

    let responseMessage = "Vehicle registered and verified successfully!";
    if (verificationResult.status === "MANUAL_REVIEW") {
      responseMessage = "Vehicle registered and submitted for administrator review.";
    } else if (verificationResult.status === "VERIFICATION_FAILED") {
      responseMessage = "Vehicle registered. RC verification is temporarily unavailable and will be re-attempted shortly.";
    }

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        verificationStatus: verificationResult.status,
        vehicle: newVehicle,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(" Vehicle POST API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register vehicle. Please try again." },
      { status: 500 }
    );
  }
}
