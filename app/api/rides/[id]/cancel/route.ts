import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { cancellationService } from "@/lib/concurrency/CancellationService";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST: Atomic cancellation and seat release for a booking request
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { id: requestId } = params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking request identifier." },
        { status: 400 }
      );
    }

    const userRole = session.user.role === "admin" ? "admin" : "passenger";

    const result = await cancellationService.cancelBookingAndReleaseSeats(
      requestId,
      session.user.id,
      userRole
    );

    const statusCode = result.success ? 200 : 400;
    return NextResponse.json(result, { status: statusCode });
  } catch (error: any) {
    console.error("Cancellation API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process booking cancellation." },
      { status: 500 }
    );
  }
}
