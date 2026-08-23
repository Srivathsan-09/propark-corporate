import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Report from "@/models/Report";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const reports = await Report.find({ reporter: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      reports: reports || [],
    });
  } catch (error: any) {
    console.error("Fetch reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch incident reports." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, description, category, priority, involvedUserName, rideId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Report title / summary is required." },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: "Detailed incident description is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fetch user details for complete snapshot
    const user = await User.findById(session.user.id).lean();

    // Generate sequential Report ID (e.g. INC-001)
    const count = await Report.countDocuments();
    const reportId = `INC-${String(count + 1).padStart(3, "0")}`;

    const newReport = await Report.create({
      reportId,
      reporter: session.user.id,
      reporterName: session.user.name || user?.name || "Anonymous Commuter",
      reporterEmail: (session.user.email || user?.email || "").toLowerCase(),
      reporterPhone: user?.phone || "",
      reporterCampusId: (session.user.campusId || user?.campusId || "").toUpperCase(),
      reporterCompany: session.user.companyName || user?.companyName || "",
      involvedUserName: (involvedUserName || "").trim(),
      ride: rideId || undefined,
      category: category || "other",
      priority: priority || "medium",
      title: title.trim(),
      description: description.trim(),
      status: "pending",
      actionTaken: "none",
    });

    return NextResponse.json({
      success: true,
      message: `Incident report ${reportId} filed successfully. Safety team will investigate.`,
      report: newReport,
    });
  } catch (error: any) {
    console.error("Create report error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit incident report." },
      { status: 500 }
    );
  }
}
