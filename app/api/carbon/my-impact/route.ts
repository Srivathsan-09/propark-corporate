import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserCarbonStats } from "@/lib/services/carbonCalculation";
import EmissionFactor from "@/models/EmissionFactor";
import { connectToDatabase } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const stats = await getUserCarbonStats(session.user.id);
    const activeFactor = await EmissionFactor.findOne({ isActive: true }).lean();

    return NextResponse.json({
      success: true,
      stats,
      activeEmissionFactorSource: activeFactor?.source || "IPCC 2006 / MoEFCC India GHG Platform",
      activeSourceReference: activeFactor?.sourceReference || "India GHG Platform Baseline",
    });
  } catch (error: any) {
    console.error(" My Impact Carbon API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve environmental impact data." },
      { status: 500 }
    );
  }
}
