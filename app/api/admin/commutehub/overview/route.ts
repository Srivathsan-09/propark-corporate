import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCommuteHubOverview } from "@/lib/services/commuteHubAnalytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";

    if (!isSuperAdmin && !isCampusAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterCampus = searchParams.get("campusId");

    const effectiveCampusId = isCampusAdmin ? session.user.campusId : (filterCampus || undefined);

    const data = await getCommuteHubOverview(effectiveCampusId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("CommuteHub Overview API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch CommuteHub overview analytics" },
      { status: 500 }
    );
  }
}
