import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Vehicle from "@/models/Vehicle";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid vehicle identifier." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, rejectionReason } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const isApprove = action === "approve";

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      {
        $set: {
          verificationStatus: isApprove ? "approved" : "rejected",
          isApproved: isApprove,
          rejectionReason: isApprove ? "" : rejectionReason || "Rejected by campus administrator",
        },
      },
      { new: true }
    ).populate("owner", "name employeeId email department");

    if (!updatedVehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isApprove
        ? `Vehicle ${updatedVehicle.registrationNumber} (${updatedVehicle.vehicleModel}) verified and approved for carpooling.`
        : `Vehicle ${updatedVehicle.registrationNumber} status set to rejected.`,
      vehicle: updatedVehicle,
    });
  } catch (error: unknown) {
    console.error("Vehicle verification API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update vehicle verification status." },
      { status: 500 }
    );
  }
}
