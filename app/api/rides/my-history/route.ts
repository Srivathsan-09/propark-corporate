import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { getEmployeeCompleteHistory } from "@/lib/services/historyService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to view your commute history." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    let dbUserId = session.user.id;
    if (session.user.email) {
      const userDoc = await User.findOne({ email: session.user.email.toLowerCase().trim() }).select("_id").lean();
      if (userDoc) {
        dbUserId = userDoc._id.toString();
      }
    }

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const role = (searchParams.get("role") as any) || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Strictly fetch only this employee's own history
    const historyData = await getEmployeeCompleteHistory(dbUserId, {
      dateFrom,
      dateTo,
      role,
      status,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...historyData,
    });
  } catch (error: any) {
    console.error("Employee My History Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load personal commute history." },
      { status: 500 }
    );
  }
}
