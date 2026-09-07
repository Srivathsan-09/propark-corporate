import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { getEmployeeCompleteHistory } from "@/lib/services/historyService";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!id || (!mongoose.Types.ObjectId.isValid(id) && id.length !== 24)) {
      return NextResponse.json(
        { success: false, error: "Invalid employee identifier." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const targetUser = await User.findById(id).select("campusId role name").lean();
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Employee record not found." },
        { status: 404 }
      );
    }

    // Strict Backend Campus Isolation Check:
    // Campus Admin can ONLY view history of employees from their assigned campus
    const isSuperAdmin = session.user.role === "admin";
    if (!isSuperAdmin) {
      const adminCampusId = (session.user.campusId || "").trim().toUpperCase();
      const empCampusId = (targetUser.campusId || "").trim().toUpperCase();

      if (adminCampusId && empCampusId && adminCampusId !== empCampusId) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden. You are not authorized to view commute history for employees outside your designated campus.",
          },
          { status: 403 }
        );
      }
    }

    // Extract filters from URL query parameters
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const role = (searchParams.get("role") as any) || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const activityType = searchParams.get("activityType") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const historyData = await getEmployeeCompleteHistory(id, {
      dateFrom,
      dateTo,
      role,
      status,
      activityType,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...historyData,
    });
  } catch (error: any) {
    console.error("Admin Employee Complete History Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve employee commute history." },
      { status: 500 }
    );
  }
}
