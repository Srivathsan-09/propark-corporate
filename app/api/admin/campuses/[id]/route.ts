import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
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

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { campusId: id.toUpperCase().trim() };

    const campus = await Campus.findOne(query);
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
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only Super Administrators can delete campuses." },
        { status: 403 }
      );
    }

    const { id } = params;
    await connectToDatabase();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { campusId: id.toUpperCase().trim() };

    const deleted = await Campus.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Campus not found for deletion." },
        { status: 404 }
      );
    }

    // Delete all companies associated with this campus
    await Company.deleteMany({ campusId: deleted.campusId });

    return NextResponse.json({
      success: true,
      message: `Campus "${deleted.name}" (${deleted.campusId}) deleted successfully.`,
    });
  } catch (error: unknown) {
    console.error("Admin Campus DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete campus." },
      { status: 500 }
    );
  }
}
