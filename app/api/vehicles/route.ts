import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";

export const dynamic = "force-dynamic";
import { vehicleSchema } from "@/validations/vehicle.schema";

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

    const normalizedPlate = registrationNumber.toUpperCase().trim();

    // Check if plate already registered in platform
    const existingVehicle = await Vehicle.findOne({ registrationNumber: normalizedPlate });
    if (existingVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "A vehicle with this registration plate number is already registered.",
        },
        { status: 409 }
      );
    }

    // Create vehicle strictly owned by the authenticated session user
    const newVehicle = await Vehicle.create({
      owner: session.user.id,
      vehicleType,
      fuelType: fuelType || "Petrol",
      engineCapacity: engineCapacity || "",
      vehicleModel,
      registrationNumber: normalizedPlate,
      seatingCapacity,
      availableSeats,
      vehiclePhoto: vehiclePhoto || "",
      numberPlatePhoto: numberPlatePhoto || "",
      drivingLicensePhoto: drivingLicensePhoto || "",
      verificationStatus: "pending",
      isApproved: false,
      status: status || "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle registered successfully! It has been submitted for campus admin verification.",
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
