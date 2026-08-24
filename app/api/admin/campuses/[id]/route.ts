import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { decode } from "next-auth/jwt";
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

      // Log admin audit action
      const { logAdminActivity } = await import("@/lib/auditLogger");
      await logAdminActivity(req, session, {
        action: rawEmail ? "CAMPUS_ADMIN_ASSIGNED" : "CAMPUS_ADMIN_REVOKED",
        targetEntity: "Campus",
        targetId: campus.campusId,
        targetName: campus.name,
        details: rawEmail
          ? `Assigned "${rawEmail}" as Campus Administrator for ${campus.name} (${campus.campusId}).`
          : `Revoked Campus Administrator privileges for ${campus.name} (${campus.campusId}).`,
      });

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
    const JWT_SECRET =
      process.env.NEXTAUTH_SECRET ||
      "propark_corporate_mobility_platform_super_secret_2026_key";

    // ── Layer 1: Read the JWT cookie directly (works in both dev + Vercel prod) ──
    // Vercel HTTPS uses __Secure-next-auth.session-token
    // Local dev uses next-auth.session-token
    const jwtCookie =
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value;

    let userEmail: string | undefined;
    let userRole: string | undefined;

    if (jwtCookie) {
      try {
        const decoded = await decode({ token: jwtCookie, secret: JWT_SECRET });
        userEmail = decoded?.email as string | undefined;
        userRole = decoded?.role as string | undefined;
        console.log(`DELETE campus [JWT]: email="${userEmail}" role="${userRole}"`);
      } catch (jwtErr) {
        console.warn("DELETE campus: JWT decode failed:", jwtErr);
      }
    } else {
      console.warn("DELETE campus: no JWT cookie found in request");
    }

    // ── Layer 2: If we have an email but role isn't "admin", check DB directly ──
    await connectToDatabase();
    if (userEmail && userRole !== "admin") {
      const dbUser = await User.findOne({ email: userEmail.toLowerCase().trim() }).select("role");
      userRole = dbUser?.role;
      console.log(`DELETE campus [DB lookup]: email="${userEmail}" dbRole="${userRole}"`);
    }

    // ── Layer 3: Hardcoded super-admin email as ultimate fallback ──
    const SUPER_ADMIN_EMAILS = ["srimana2006@gmail.com", "admin@propark.corporate.com"];
    if (userRole !== "admin" && userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase().trim())) {
      userRole = "admin";
      console.log(`DELETE campus [hardcoded]: email "${userEmail}" granted admin via hardcoded list`);
    }

    // ── Layer 4: Last resort — check session (may fail on cold starts but worth trying) ──
    if (userRole !== "admin") {
      try {
        const session = await getServerSession(authOptions);
        const sessionEmail = session?.user?.email;
        const sessionRole = session?.user?.role;
        console.log(`DELETE campus [session]: email="${sessionEmail}" role="${sessionRole}"`);
        if (sessionRole === "admin") {
          userRole = "admin";
          userEmail = sessionEmail || userEmail;
        }
      } catch (sessErr) {
        console.warn("DELETE campus: getServerSession failed:", sessErr);
      }
    }

    // ── Auth gate ──
    if (userRole !== "admin") {
      console.warn(`DELETE campus BLOCKED — final role="${userRole}" email="${userEmail}" | cookie=${jwtCookie ? "present" : "MISSING"}`);
      return NextResponse.json(
        { success: false, error: `Access denied. Role="${userRole ?? "none"}". Please sign out and sign back in, then try again.` },
        { status: 403 }
      );
    }

    // ── Delete the campus ──
    const { id } = params;
    const idParam = decodeURIComponent(id || "").trim();
    console.log(`DELETE campus: authorized as "${userEmail}", deleting campusId="${idParam}"`);

    // Try case-insensitive regex
    let deleted = await Campus.findOneAndDelete({
      campusId: new RegExp(`^${idParam}$`, "i"),
    });

    // Fallback: exact uppercase
    if (!deleted) {
      deleted = await Campus.findOneAndDelete({ campusId: idParam.toUpperCase() });
    }

    // Fallback: ObjectId
    if (!deleted && mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24) {
      deleted = await Campus.findOneAndDelete({ _id: new mongoose.Types.ObjectId(idParam) });
    }

    if (!deleted) {
      console.warn(`DELETE campus: campusId="${idParam}" NOT FOUND in MongoDB`);
      return NextResponse.json(
        { success: false, error: `Campus "${idParam}" not found — it may have already been deleted.` },
        { status: 404 }
      );
    }

    const targetCampusId = deleted.campusId;
    console.log(`DELETE campus:  PERMANENTLY DELETED "${deleted.name}" (${targetCampusId})`);

    // Cascade: delete associated companies
    const { deletedCount: compCount } = await Company.deleteMany({
      campusId: new RegExp(`^${targetCampusId}$`, "i"),
    });

    // Cascade: unlink users
    await User.updateMany(
      { campusId: new RegExp(`^${targetCampusId}$`, "i") },
      { $unset: { campusId: "", campusName: "" }, $set: { role: "employee" } }
    );

    console.log(`DELETE campus: cascade — removed ${compCount} companies, unlinked users for ${targetCampusId}`);

    // Log admin audit action
    const { logAdminActivity } = await import("@/lib/auditLogger");
    await logAdminActivity(
      req,
      { user: { email: userEmail, name: "Super Admin", role: userRole } },
      {
        action: "CAMPUS_DELETED",
        targetEntity: "Campus",
        targetId: targetCampusId,
        targetName: deleted.name,
        details: `Permanently deleted physical campus "${deleted.name}" (${targetCampusId}) and cascadingly unlinked users and removed companies.`,
      }
    );

    return NextResponse.json({
      success: true,
      message: `"${deleted.name}" has been permanently deleted from the system.`,
      campusId: targetCampusId,
    });
  } catch (error: unknown) {
    console.error("Admin Campus DELETE unhandled error:", error);
    return NextResponse.json(
      { success: false, error: "Server error during deletion. Check Vercel logs." },
      { status: 500 }
    );
  }
}
