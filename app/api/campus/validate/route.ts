import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import CampusCompany from "@/models/CampusCompany";
import Campus from "@/models/Campus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campusId = searchParams.get("campusId");

    await connectToDatabase();

    if (!campusId) {
      // Return all active campuses and company memberships for reference
      const campuses = await Campus.find({ status: "active" }).lean();
      const campusCompanies = await CampusCompany.find({ status: "active" }).lean();
      return NextResponse.json({
        success: true,
        campuses,
        campusCompanies,
      });
    }

    const normalized = campusId.toUpperCase().trim();
    const match = await CampusCompany.findOne({
      campusCompanyId: normalized,
      status: "active",
    }).lean();

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: `Campus ID "${normalized}" is not recognized in CommuteX.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      campusCompany: match,
    });
  } catch (error: unknown) {
    console.error("Campus validation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate Campus ID." },
      { status: 500 }
    );
  }
}
