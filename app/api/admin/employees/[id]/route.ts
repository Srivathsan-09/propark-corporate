import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Vehicle from "@/models/Vehicle";
import Ride from "@/models/Ride";
import Notification from "@/models/Notification";
import EmployeeActivity from "@/models/EmployeeActivity";
import CarbonEmission from "@/models/CarbonEmission";
import Campus from "@/models/Campus";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "campus_admin")
    ) {
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

    // Protect against self-deletion
    if (session.user.id === id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account while logged in." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Employee account not found." },
        { status: 404 }
      );
    }

    // Protect primary Super Admin accounts
    if (targetUser.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Super Administrator accounts cannot be deleted from the employee directory." },
        { status: 403 }
      );
    }

    // Campus admin permission check
    if (session.user.role === "campus_admin") {
      if (targetUser.campusId !== session.user.campusId) {
        return NextResponse.json(
          { success: false, error: "You are only authorized to manage employees from your assigned campus." },
          { status: 403 }
        );
      }
      if (targetUser.role !== "employee") {
        return NextResponse.json(
          { success: false, error: "Campus Administrators cannot delete administrative accounts." },
          { status: 403 }
        );
      }
    }

    const targetUserId = targetUser._id;
    const targetEmail = targetUser.email.toLowerCase().trim();
    const employeeName = targetUser.name;
    const employeeId = targetUser.employeeId;

    // 1. Cascade delete registered vehicles
    await Vehicle.deleteMany({ owner: targetUserId });

    // 2. Cascade delete/clean up rides where user is driver
    await Ride.deleteMany({ driver: targetUserId });

    // 3. Remove user from passenger requests in other rides
    await Ride.updateMany(
      { "passengers.passenger": targetUserId },
      { $pull: { passengers: { passenger: targetUserId } } }
    );

    // 4. Delete notifications
    await Notification.deleteMany({
      $or: [{ recipient: targetUserId }, { sender: targetUserId }],
    });

    // 5. Delete activities
    await EmployeeActivity.deleteMany({ employee: targetUserId });

    // 6. Delete carbon emission calculations
    await CarbonEmission.deleteMany({ user: targetUserId });

    // 7. Unset campus admin assignment if any
    await Campus.updateMany(
      { adminEmail: targetEmail },
      { $unset: { adminEmail: "" } }
    );

    // 8. Delete user document
    await User.findByIdAndDelete(targetUserId);

    // 9. Log admin audit action
    const { logAdminActivity } = await import("@/lib/auditLogger");
    await logAdminActivity(req, session, {
      action: "EMPLOYEE_DELETED" as any,
      targetEntity: "User",
      targetId: employeeId || String(targetUserId),
      targetName: employeeName,
      details: `Permanently deleted employee ${employeeName} (${targetEmail}, ${employeeId}) and associated vehicles and ride bookings.`,
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employeeName} (${employeeId}) has been permanently deleted.`,
    });
  } catch (error: unknown) {
    console.error("Delete employee API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete employee account." },
      { status: 500 }
    );
  }
}
