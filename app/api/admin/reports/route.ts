import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Report from "@/models/Report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isSuperAdmin = session?.user?.role === "admin";
    const isCampusAdmin = session?.user?.role === "campus_admin";

    if (!session || !session.user || (!isSuperAdmin && !isCampusAdmin)) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const campusId = searchParams.get("campusId");
    const search = searchParams.get("search");

    const query: any = {};

    // Campus admin is strictly scoped to their assigned campus
    if (isCampusAdmin && session.user.campusId) {
      query.reporterCampusId = new RegExp(`^${session.user.campusId}$`, "i");
    } else if (campusId && campusId !== "all") {
      query.reporterCampusId = new RegExp(`^${campusId}$`, "i");
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { reportId: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { reporterName: searchRegex },
        { reporterEmail: searchRegex },
        { reporterCompany: searchRegex },
      ];
    }

    const reports = await Report.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      reports: reports || [],
      isSuperAdmin,
    });
  } catch (error: any) {
    console.error("Admin fetch reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch incidents." },
      { status: 500 }
    );
  }
}
