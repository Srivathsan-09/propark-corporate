import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCommuteHubIntelligence } from "@/lib/services/commuteHubIntelligence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Strict Authorization: Admin or Campus Admin only
    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "campus_admin")
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isSuperAdmin = session.user.role === "admin";
    const requestedCampusId = searchParams.get("campusId");
    const dateRange = searchParams.get("dateRange") || "30d";

    // Campus Admins are strictly scoped to their assigned campus
    let effectiveCampusId: string | undefined = undefined;
    if (!isSuperAdmin) {
      effectiveCampusId = session.user.campusId;
    } else if (requestedCampusId && requestedCampusId !== "all") {
      effectiveCampusId = requestedCampusId;
    }

    const data = await getCommuteHubIntelligence({
      campusId: effectiveCampusId,
      dateRange,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("CommuteHub Analytics API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate CommuteHub intelligence." },
      { status: 500 }
    );
  }
}
