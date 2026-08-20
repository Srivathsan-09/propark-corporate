import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Vehicle from "@/models/Vehicle";

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
    const query = isSuperAdmin ? {} : { campusId: session.user.campusId };

    // Fetch registered employees sorted in ascending order (EMP-001, EMP-002...)
    const employees = await User.find(query)
      .select("-passwordHash")
      .sort({ employeeId: 1, createdAt: 1 })
      .lean();

    // Fetch vehicle counts per user
    const vehicleCounts = await Vehicle.aggregate([
      { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(vehicleCounts.map((v) => [v._id.toString(), v.count]));

    const enrichedEmployees = employees.map((emp) => ({
      ...emp,
      vehicleCount: countMap.get(emp._id.toString()) || 0,
    }));

    return NextResponse.json({
      success: true,
      employees: enrichedEmployees,
    });
  } catch (error: unknown) {
    console.error("Admin Employees GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees list." },
      { status: 500 }
    );
  }
}
