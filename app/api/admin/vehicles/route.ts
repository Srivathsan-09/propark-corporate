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
    const testVehiclesExclusion = {
      registrationNumber: { $nin: ["TN 07 LT 9999", "TN-07-LT-9999", "TN07LT9999"] },
    };

    let ownerQuery: Record<string, any> = { ...testVehiclesExclusion };
    if (isSuperAdmin) {
      const adminUsers = await User.find({ role: "admin" }).select("_id");
      const adminIds = adminUsers.map((u) => u._id);
      ownerQuery = { owner: { $nin: adminIds }, ...testVehiclesExclusion };
    } else {
      // Campus Admin: only vehicles belonging to employees of their campus
      const userFilter: Record<string, any> = {};
      if (session.user.campusId) {
        userFilter.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      } else {
        userFilter.campusId = { $nin: ["CAMP-LOADTEST-01", "CAMP-LOADTEST"] };
      }
      const campusUsers = await User.find(userFilter).select("_id");
      const campusUserIds = campusUsers.map((u) => u._id);
      ownerQuery = { owner: { $in: campusUserIds }, ...testVehiclesExclusion };
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
