import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
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
        { success: false, error: "Invalid employee identifier." },
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

    const targetEmployee = await User.findById(id);
    if (!targetEmployee) {
      return NextResponse.json(
        { success: false, error: "Employee account not found." },
        { status: 404 }
      );
    }

    // Campus Admin can only approve/reject employees from their own physical campus
    if (session.user.role === "campus_admin" && targetEmployee.campusId !== session.user.campusId) {
      return NextResponse.json(
        { success: false, error: "You are only authorized to manage employees from your own physical campus." },
        { status: 403 }
      );
    }

    const isApprove = action === "approve";

    targetEmployee.verificationStatus = isApprove ? "approved" : "rejected";
    targetEmployee.isApproved = isApprove;
    targetEmployee.rejectionReason = isApprove ? "" : rejectionReason || "Rejected by campus administrator";
    await targetEmployee.save();

    const updatedEmployee = targetEmployee.toObject() as Record<string, any>;
    delete updatedEmployee.passwordHash;

    // When an employee is approved, also automatically approve their registered fleet
    if (isApprove) {
      await Vehicle.updateMany(
        { owner: updatedEmployee._id },
        { $set: { verificationStatus: "approved", isApproved: true } }
      );
    }

    // Log admin audit action
    const { logAdminActivity } = await import("@/lib/auditLogger");
    await logAdminActivity(req, session, {
      action: isApprove ? "EMPLOYEE_APPROVED" : "EMPLOYEE_REJECTED",
      targetEntity: "User",
      targetId: updatedEmployee.employeeId || String(updatedEmployee._id),
      targetName: updatedEmployee.name,
      details: isApprove
        ? `Approved corporate verification for ${updatedEmployee.name} (${updatedEmployee.email}).`
        : `Rejected verification for ${updatedEmployee.name}. Reason: ${targetEmployee.rejectionReason}`,
    });

    return NextResponse.json({
      success: true,
      message: isApprove
        ? `Employee ${updatedEmployee.name} has been verified and approved.`
        : `Employee ${updatedEmployee.name} verification status set to rejected.`,
      employee: updatedEmployee,
    });
  } catch (error: unknown) {
    console.error("Employee verification API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update employee verification status." },
      { status: 500 }
    );
  }
}
