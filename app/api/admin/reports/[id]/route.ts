import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Report from "@/models/Report";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await req.json();
    const { status, resolutionNotes, actionTaken, priority } = body;

    await connectToDatabase();

    const idParam = decodeURIComponent(id || "").trim();
    const isObjId = mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24;

    const query = isObjId
      ? { $or: [{ _id: new mongoose.Types.ObjectId(idParam) }, { reportId: idParam.toUpperCase() }] }
      : { reportId: idParam.toUpperCase() };

    const report = await Report.findOne(query);

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Incident report not found." },
        { status: 404 }
      );
    }

    if (isCampusAdmin && report.reporterCampusId !== session.user.campusId) {
      return NextResponse.json(
        { success: false, error: "You can only triage reports for your assigned campus." },
        { status: 403 }
      );
    }

    if (status) report.status = status;
    if (priority) report.priority = priority;
    if (actionTaken) report.actionTaken = actionTaken;
    if (resolutionNotes !== undefined) report.resolutionNotes = resolutionNotes.trim();

    if (status === "resolved" || status === "dismissed") {
      report.resolvedBy = session.user.name || session.user.email || "Safety Officer";
      report.resolvedAt = new Date();
    }

    await report.save();

    // Log admin audit action
    const { logAdminActivity } = await import("@/lib/auditLogger");
    await logAdminActivity(req, session, {
      action: status === "resolved" ? "INCIDENT_RESOLVED" : "INCIDENT_STATUS_UPDATED",
      targetEntity: "Report",
      targetId: report.reportId,
      targetName: report.title,
      details: `Updated incident status to "${report.status}". Priority: "${report.priority}", Action Taken: "${report.actionTaken}". Findings: ${report.resolutionNotes || "None"}`,
    });

    return NextResponse.json({
      success: true,
      message: `Report ${report.reportId} updated successfully.`,
      report,
    });
  } catch (error: any) {
    console.error("Admin update report error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update incident report." },
      { status: 500 }
    );
  }
}
