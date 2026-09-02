import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getOccupancyCarbonAnalytics } from "@/lib/services/carbonCalculation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin" && session.user.role !== "campus_admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const campusId = searchParams.get("campusId") || undefined;

    const occupancyData = await getOccupancyCarbonAnalytics(campusId);

    return NextResponse.json({
      success: true,
      data: occupancyData,
    });
  } catch (error: any) {
    console.error(" Occupancy Carbon Analytics API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve occupancy carbon analytics." },
      { status: 500 }
    );
  }
}
