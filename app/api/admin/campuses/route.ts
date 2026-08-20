import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const campuses = await Campus.find().sort({ campusId: 1 }).lean();

    // Enrich with employee count per campus
    const employeeCounts = await User.aggregate([
      { $group: { _id: "$campusId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(employeeCounts.map((c) => [c._id, c.count]));

    const enrichedCampuses = campuses.map((c) => ({
      ...c,
      employeeCount: countMap.get(c.campusId) || 0,
      companiesCount: c.companies ? c.companies.length : 0,
    }));

    return NextResponse.json({
      success: true,
      campuses: enrichedCampuses,
    });
  } catch (error: unknown) {
    console.error("Admin Campuses GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campuses." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { campusId, name, address, city, state, companies } = body;

    if (!campusId || !name || !city || !state) {
      return NextResponse.json(
        { success: false, error: "Campus ID, Name, City, and State are required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalizedCampusId = campusId.toUpperCase().trim();

    const existing = await Campus.findOne({ campusId: normalizedCampusId });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Campus ID "${normalizedCampusId}" already exists.` },
        { status: 409 }
      );
    }

    // Clean up companies array
    const cleanedCompanies = Array.isArray(companies)
      ? companies.map((c: string) => c.trim()).filter((c: string) => c.length > 0)
      : [];

    const newCampus = await Campus.create({
      campusId: normalizedCampusId,
      name: name.trim(),
      address: address?.trim() || `${city}, ${state}`,
      city: city.trim(),
      state: state.trim(),
      companies: cleanedCompanies,
      status: "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Campus "${newCampus.name}" (${newCampus.campusId}) created successfully!`,
        campus: newCampus,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Admin Campus POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create campus." },
      { status: 500 }
    );
  }
}
