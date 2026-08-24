import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campusId = searchParams.get("campusId");

    await connectToDatabase();

    if (!campusId) {
      // Return all active campuses with their companies
      const campuses = await Campus.find({ status: "active" }).lean();
      return NextResponse.json({
        success: true,
        campuses,
      });
    }

    const clean = campusId.toUpperCase().trim();
    const withoutHyphen = clean.replace(/[-_]/g, "");
    const match = await Campus.findOne({
      $or: [
        { campusId: clean },
        { campusId: withoutHyphen },
        { campusId: { $regex: new RegExp(`^${withoutHyphen.replace(/([0-9]+)/, "-?$1")}$`, "i") } }
      ],
      status: "active",
    }).lean();

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: `Campus ID "${campusId}" is not recognized. Please check your Campus ID (e.g. CAMP001, CAMP002).`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      campus: match,
    });
  } catch (error: unknown) {
    console.error("Campus validation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate Campus ID." },
      { status: 500 }
    );
  }
}
