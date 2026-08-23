import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User"; // Ensure User model is loaded for populate

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const isSuperAdmin = session.user.role === "admin";

    let ownerQuery: Record<string, any> = {};
    if (isSuperAdmin) {
      const adminUsers = await User.find({ role: "admin" }).select("_id");
      const adminIds = adminUsers.map((u) => u._id);
      ownerQuery = { owner: { $nin: adminIds } };
    } else {
      // Campus Admin: only vehicles belonging to employees of their campus
      const campusQuery = session.user.campusId
        ? { campusId: new RegExp(`^${session.user.campusId}$`, "i") }
        : {};
      const campusUsers = await User.find(campusQuery).select("_id");
      const campusUserIds = campusUsers.map((u) => u._id);
      ownerQuery = { owner: { $in: campusUserIds } };
    }

    const vehicles = await Vehicle.find(ownerQuery)
      .populate("owner", "name email employeeId department phone campusId companyName")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      vehicles,
    });
  } catch (error: unknown) {
    console.error("Admin Vehicles GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch registered vehicles." },
      { status: 500 }
    );
  }
}
