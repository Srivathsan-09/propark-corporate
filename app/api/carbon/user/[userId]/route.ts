import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { getUserCarbonStats } from "@/lib/services/carbonCalculation";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    userId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { userId } = params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: "Invalid user identifier." },
        { status: 400 }
      );
    }

    // Security Check: Normal users can only view their own data; admins can view any user's
    const isSelf = session.user.id === userId;
    const isAdmin = session.user.role === "admin" || session.user.role === "campus_admin";

    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. You cannot access another user's environmental impact data." },
        { status: 403 }
      );
    }

    const stats = await getUserCarbonStats(userId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error(" User Carbon Stats API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve user carbon statistics." },
      { status: 500 }
    );
  }
}
