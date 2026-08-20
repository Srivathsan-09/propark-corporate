import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";
import Company from "@/models/Company";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();

    await connectToDatabase();

    const idParam = decodeURIComponent(id || "").trim();
    const isObjId = mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24;

    const query = isObjId
      ? { $or: [{ _id: new mongoose.Types.ObjectId(idParam) }, { campusId: new RegExp(`^${idParam}$`, "i") }] }
      : { campusId: new RegExp(`^${idParam}$`, "i") };

    let campus = await Campus.findOne(query);
    if (!campus) {
      campus = await Campus.findOne({
        $or: [
          { campusId: idParam.toUpperCase() },
          { name: new RegExp(`^${idParam}$`, "i") },
        ],
      });
    }

    if (!campus) {
      return NextResponse.json(
        { success: false, error: "Campus not found." },
        { status: 404 }
      );
    }

    const isSuperAdmin = session.user.role === "admin";
    const isThisCampusAdmin =
      session.user.role === "campus_admin" &&
      (session.user.campusId === campus.campusId || session.user.email?.toLowerCase() === campus.adminEmail?.toLowerCase());

    if (!isSuperAdmin && !isThisCampusAdmin) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to modify this campus." },
        { status: 403 }
      );
    }

    // 1. Assign / Reassign Campus Admin (Super Admin only)
    if (body.action === "assign_admin") {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: "Only Super Admin can assign Campus Admins." },
          { status: 403 }
        );
      }

      const rawEmail = body.adminEmail ? body.adminEmail.toLowerCase().trim() : "";
      campus.adminEmail = rawEmail || undefined;
      await campus.save();

      if (rawEmail) {
        await User.updateOne(
          { email: rawEmail },
          {
            $set: {
              role: "campus_admin",
              campusId: campus.campusId,
              campusName: campus.name,
              isApproved: true,
              verificationStatus: "approved",
            },
          }
        );
      }

      return NextResponse.json({
        success: true,
        message: rawEmail ? `Assigned "${rawEmail}" as Campus Admin for ${campus.name}.` : `Unassigned Campus Admin from ${campus.name}.`,
        campus,
      });
    }

    // 2. Request new company (Campus Admin requests Super Admin approval)
    if (body.action === "request_company" && body.companyName) {
      const trimmed = body.companyName.trim();

      if (campus.companies.includes(trimmed)) {
        return NextResponse.json(
          { success: false, error: `Company "${trimmed}" is already active in ${campus.name}.` },
          { status: 400 }
        );
      }

      const alreadyPending = campus.pendingCompanies?.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (alreadyPending) {
        return NextResponse.json(
          { success: false, error: `Company "${trimmed}" is already pending Super Admin approval.` },
          { status: 400 }
        );
      }

      if (!campus.pendingCompanies) campus.pendingCompanies = [];
      campus.pendingCompanies.push({
        name: trimmed,
        requestedBy: session.user.email || "Campus Admin",
        requestedAt: new Date(),
      });

      await campus.save();

      return NextResponse.json({
        success: true,
        message: `Request to add "${trimmed}" submitted! Waiting for Super Admin approval.`,
        campus,
      });
    }

    // 3. Approve company addition (Super Admin only)
    if (body.action === "approve_company" && body.companyName) {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: "Only Super Admin can approve company additions." },
          { status: 403 }
        );
      }

      const trimmed = body.companyName.trim();
      campus.pendingCompanies = (campus.pendingCompanies || []).filter((p) => p.name !== trimmed);

      if (!campus.companies.includes(trimmed)) {
        campus.companies.push(trimmed);
      }

      await campus.save();

      // Persist in Company collection
      await Company.updateOne(
        { campusId: campus.campusId, name: trimmed },
        {
          $set: {
            campusId: campus.campusId,
            campusName: campus.name,
            name: trimmed,
            status: "active",
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: `Approved "${trimmed}" for ${campus.name}!`,
        campus,
      });
    }

    // 4. Reject company addition (Super Admin only)
    if (body.action === "reject_company" && body.companyName) {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: "Only Super Admin can reject company additions." },
          { status: 403 }
        );
      }

      const trimmed = body.companyName.trim();
      campus.pendingCompanies = (campus.pendingCompanies || []).filter((p) => p.name !== trimmed);
      await campus.save();

      return NextResponse.json({
        success: true,
        message: `Rejected company request for "${trimmed}".`,
        campus,
      });
    }

    // 5. Add Company (Super Admin for all campuses, Campus Admin for their respective campus)
    if (body.action === "add_company" && body.companyName) {
      const trimmed = body.companyName.trim();

      if (campus.companies.includes(trimmed)) {
        return NextResponse.json(
          { success: false, error: `Company "${trimmed}" is already active in ${campus.name}.` },
          { status: 400 }
        );
      }

      campus.companies.push(trimmed);
      campus.pendingCompanies = (campus.pendingCompanies || []).filter((p) => p.name !== trimmed);
      await campus.save();

      // Persist in Company collection
      await Company.updateOne(
        { campusId: campus.campusId, name: trimmed },
        {
          $set: {
            campusId: campus.campusId,
            campusName: campus.name,
            name: trimmed,
            status: "active",
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: `Company "${trimmed}" added to ${campus.name}.`,
        campus,
      });
    }

    // 6. Remove Company
    if (body.action === "remove_company" && body.companyName) {
      const trimmed = body.companyName.trim();
      campus.companies = campus.companies.filter((c) => c !== trimmed);
      await campus.save();

      // Delete from Company collection
      await Company.deleteOne({ campusId: campus.campusId, name: trimmed });

      return NextResponse.json({
        success: true,
        message: `Company "${trimmed}" removed from ${campus.name}.`,
        campus,
      });
    }

    // 7. Full update
    if (isSuperAdmin) {
      if (body.name) campus.name = body.name.trim();
      if (body.address) campus.address = body.address.trim();
      if (body.city) campus.city = body.city.trim();
      if (body.state) campus.state = body.state.trim();
      if (body.status) campus.status = body.status;
      if (body.adminEmail !== undefined) campus.adminEmail = body.adminEmail ? body.adminEmail.toLowerCase().trim() : undefined;
      if (Array.isArray(body.companies)) {
        campus.companies = body.companies.map((c: string) => c.trim()).filter(Boolean);
        // Replace in Company collection
        await Company.deleteMany({ campusId: campus.campusId });
        if (campus.companies.length > 0) {
          const docs = campus.companies.map((c: string) => ({
            campusId: campus.campusId,
            campusName: campus.name,
            name: c,
            status: "active",
          }));
          await Company.insertMany(docs, { ordered: false }).catch(() => {});
        }
      }

      await campus.save();
    }

    return NextResponse.json({
      success: true,
      message: `Campus "${campus.name}" updated successfully.`,
      campus,
    });
  } catch (error: unknown) {
    console.error("Admin Campus PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update campus." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use getToken — reads JWT directly from cookie, always reliable on Vercel
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || "propark_corporate_mobility_platform_super_secret_2026_key",
    });

    const tokenRole = token?.role as string | undefined;
    const tokenEmail = token?.email as string | undefined;

    console.log(`DELETE campus: token role="${tokenRole}" email="${tokenEmail}"`);

    // If JWT says not admin, do one final DB lookup as safety net
    let effectiveRole = tokenRole;
    if (effectiveRole !== "admin" && tokenEmail) {
      await connectToDatabase();
      const dbUser = await User.findOne({ email: tokenEmail.toLowerCase().trim() }).select("role");
      if (dbUser?.role === "admin") {
        effectiveRole = "admin";
        console.log(`DELETE campus: DB override — email "${tokenEmail}" is admin`);
      }
    }

    if (effectiveRole !== "admin") {
      console.warn(`DELETE campus BLOCKED — effectiveRole="${effectiveRole}" email="${tokenEmail}"`);
      return NextResponse.json(
        { success: false, error: "Only Super Administrators can delete campuses." },
        { status: 403 }
      );
    }

    const { id } = params;
    await connectToDatabase();

    const idParam = decodeURIComponent(id || "").trim();
    console.log(`DELETE campus: attempting to delete campusId="${idParam}"`);

    // Try case-insensitive regex first
    let deleted = await Campus.findOneAndDelete({
      campusId: new RegExp(`^${idParam}$`, "i"),
    });

    // Fallback: exact uppercase match
    if (!deleted) {
      deleted = await Campus.findOneAndDelete({ campusId: idParam.toUpperCase() });
    }

    // Fallback: ObjectId match
    if (!deleted && mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24) {
      deleted = await Campus.findOneAndDelete({ _id: new mongoose.Types.ObjectId(idParam) });
    }

    if (!deleted) {
      console.warn(`DELETE campus: campusId="${idParam}" NOT FOUND in DB`);
      return NextResponse.json(
        { success: false, error: `Campus "${idParam}" not found. It may have already been deleted.` },
        { status: 404 }
      );
    }

    const targetCampusId = deleted.campusId;
    console.log(`DELETE campus: SUCCESS — deleted "${deleted.name}" (${targetCampusId})`);

    // Cascade: delete all associated companies
    const { deletedCount: compCount } = await Company.deleteMany({
      campusId: new RegExp(`^${targetCampusId}$`, "i"),
    });
    console.log(`DELETE campus: removed ${compCount} companies for ${targetCampusId}`);

    // Cascade: unlink all users from this campus
    await User.updateMany(
      { campusId: new RegExp(`^${targetCampusId}$`, "i") },
      { $set: { campusId: "", campusName: "", role: "employee" } }
    );

    return NextResponse.json({
      success: true,
      message: `Campus "${deleted.name}" (${targetCampusId}) has been permanently deleted.`,
      campusId: targetCampusId,
    });
  } catch (error: unknown) {
    console.error("Admin Campus DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Server error while deleting campus. Please try again." },
      { status: 500 }
    );
  }
}
