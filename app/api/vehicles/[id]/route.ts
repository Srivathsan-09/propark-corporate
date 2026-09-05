import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import { vehicleSchema } from "@/validations/vehicle.schema";

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

    // Check if another vehicle has the same registration plate
    const duplicateVehicle = await Vehicle.findOne({
      registrationNumber: normalizedPlate,
      _id: { $ne: id },
    });

    if (duplicateVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Another vehicle with this registration plate number already exists.",
        },
        { status: 409 }
      );
    }

    // Update ONLY if owned by the current session user
    const updatedVehicle = await Vehicle.findOneAndUpdate(
      {
        _id: id,
        owner: session.user.id,
      },
      {
        $set: {
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
          status: status || "active",
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found or you are not authorized to edit this vehicle.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vehicle updated successfully.",
      vehicle: updatedVehicle,
    });
  } catch (error: unknown) {
    console.error(" Vehicle PATCH API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update vehicle details." },
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
