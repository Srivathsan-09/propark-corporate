import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import AuditLog from "@/models/AuditLog";

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
    const action = searchParams.get("action");
    const targetEntity = searchParams.get("targetEntity");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    const query: any = {};

    if (action && action !== "all") {
      query.action = action;
    }

    if (targetEntity && targetEntity !== "all") {
      query.targetEntity = targetEntity;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { adminName: searchRegex },
        { adminEmail: searchRegex },
        { targetId: searchRegex },
        { targetName: searchRegex },
        { details: searchRegex },
        { action: searchRegex },
      ];
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      logs: logs || [],
      count: logs.length,
    });
  } catch (error: any) {
    console.error("Audit log GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs." },
      { status: 500 }
    );
  }
}
