import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";
import Company from "@/models/Company";
import User from "@/models/User";

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
    const userCampusId = session.user.campusId;

    // Super Admin sees all campuses; Campus Admin sees their assigned campus
    const query = isSuperAdmin
      ? {}
      : userCampusId
      ? { campusId: new RegExp(`^${userCampusId}$`, "i") }
      : {};
    const campuses = await Campus.find(query).sort({ campusId: 1 }).lean();

    // Sync all campus operating companies into Company collection so MongoDB has all company documents
    for (const c of campuses) {
      if (Array.isArray(c.companies) && c.companies.length > 0) {
        for (const compName of c.companies) {
          if (compName && compName.trim()) {
            await Company.updateOne(
              { campusId: c.campusId, name: compName.trim() },
              {
                $set: {
                  campusId: c.campusId,
                  campusName: c.name,
                  name: compName.trim(),
                  status: "active",
                },
              },
              { upsert: true }
            );
          }
        }
      }
    }

    // Enrich with employee count per campus
    const employeeCounts = await User.aggregate([
      { $group: { _id: "$campusId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(employeeCounts.map((c) => [c._id, c.count]));

    const enrichedCampuses = campuses.map((c) => ({
      ...c,
      employeeCount: countMap.get(c.campusId) || 0,
      companiesCount: c.companies ? c.companies.length : 0,
      pendingCount: c.pendingCompanies ? c.pendingCompanies.length : 0,
    }));

    return NextResponse.json({
      success: true,
      isSuperAdmin,
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
        { success: false, error: "Only Super Administrators can create new campuses." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { campusId, name, address, city, state, adminEmail, companies } = body;

    if (!campusId || !name || !city || !state) {
      return NextResponse.json(
        { success: false, error: "Campus ID, Name, City, and State are required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalizedCampusId = campusId.toUpperCase().trim();
    const normalizedAdminEmail = adminEmail ? adminEmail.toLowerCase().trim() : "";

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
      adminEmail: normalizedAdminEmail || undefined,
      companies: cleanedCompanies,
      pendingCompanies: [],
      status: "active",
    });

    // Also persist in the dedicated companies collection
    if (cleanedCompanies.length > 0) {
      const companyDocs = cleanedCompanies.map((comp: string) => ({
        name: comp,
        campusId: newCampus.campusId,
        campusName: newCampus.name,
        status: "active",
      }));
      await Company.insertMany(companyDocs, { ordered: false }).catch(() => {});
    }

    // If an existing user matches adminEmail, upgrade them to Campus Admin
    if (normalizedAdminEmail) {
      await User.updateOne(
        { email: normalizedAdminEmail },
        {
          $set: {
            role: "campus_admin",
            campusId: newCampus.campusId,
            campusName: newCampus.name,
            isApproved: true,
            verificationStatus: "approved",
          },
        }
      );
    }

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
