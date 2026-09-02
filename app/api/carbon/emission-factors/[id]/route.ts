import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import EmissionFactor from "@/models/EmissionFactor";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Super Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid emission factor identifier." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { gramsCO2PerKm, source, sourceReference, isActive, engineCategory } = body;

    await connectToDatabase();

    const updateFields: any = {};
    if (gramsCO2PerKm !== undefined) updateFields.gramsCO2PerKm = Number(gramsCO2PerKm);
    if (source !== undefined) updateFields.source = source;
    if (sourceReference !== undefined) updateFields.sourceReference = sourceReference;
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (engineCategory !== undefined) updateFields.engineCategory = engineCategory;

    const updated = await EmissionFactor.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Emission factor not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emission factor updated successfully.",
      emissionFactor: updated,
    });
  } catch (error: any) {
    console.error(" Emission Factor PUT API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update emission factor." },
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

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Super Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid emission factor identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Soft delete / deactivate so historical calculations remain consistent
    const updated = await EmissionFactor.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Emission factor not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emission factor deactivated successfully.",
      emissionFactor: updated,
    });
  } catch (error: any) {
    console.error(" Emission Factor DELETE API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to deactivate emission factor." },
      { status: 500 }
    );
  }
}
