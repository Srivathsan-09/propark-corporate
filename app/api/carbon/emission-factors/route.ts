import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import EmissionFactor from "@/models/EmissionFactor";
import { ensureDefaultEmissionFactors } from "@/lib/db/seedEmissionFactors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    await connectToDatabase();
    await ensureDefaultEmissionFactors();

    const factors = await EmissionFactor.find().sort({ vehicleType: 1, fuelType: 1 }).lean();

    return NextResponse.json({
      success: true,
      emissionFactors: factors,
    });
  } catch (error: any) {
    console.error(" Emission Factors GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve emission factors." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
        { success: false, error: "Access denied. Super Admin privileges required to manage emission factors." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      factorId,
      vehicleType,
      fuelType,
      engineCategory,
      gramsCO2PerKm,
      source,
      sourceReference,
      isActive,
    } = body;

    if (!factorId || !vehicleType || !fuelType || gramsCO2PerKm === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required emission factor fields." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalizedFactorId = factorId.toUpperCase().trim();
    const existing = await EmissionFactor.findOne({ factorId: normalizedFactorId });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "An emission factor with this Factor ID already exists." },
        { status: 409 }
      );
    }

    const factor = await EmissionFactor.create({
      factorId: normalizedFactorId,
      vehicleType,
      fuelType,
      engineCategory: engineCategory || "default",
      gramsCO2PerKm: Number(gramsCO2PerKm),
      source: source || "IPCC 2006 / MoEFCC India GHG Platform",
      sourceReference: sourceReference || "",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      effectiveFrom: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Emission factor created successfully.",
        emissionFactor: factor,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(" Emission Factor POST API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create emission factor." },
      { status: 500 }
    );
  }
}
