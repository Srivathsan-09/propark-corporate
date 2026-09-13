import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Campus from "@/models/Campus";

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
    const { companyName } = body;

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        { success: false, error: "Company name is required." },
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

    // Campus Admin can only manage employees from their own physical campus
    if (session.user.role === "campus_admin" && targetEmployee.campusId !== session.user.campusId) {
      return NextResponse.json(
        { success: false, error: "You are only authorized to manage employees from your assigned campus." },
        { status: 403 }
      );
    }

    const trimmedCompany = companyName.trim();

    // Verify company is valid for the employee's campus
    if (targetEmployee.campusId) {
      const campus = await Campus.findOne({
        campusId: new RegExp(`^${targetEmployee.campusId}$`, "i"),
        status: "active",
      });

      if (campus && campus.companies && campus.companies.length > 0) {
        const isRegistered = campus.companies.some(
          (c) => c.toLowerCase().trim() === trimmedCompany.toLowerCase()
        );
        if (!isRegistered) {
          return NextResponse.json(
            {
              success: false,
              error: `"${trimmedCompany}" is not an active operating company at ${campus.name} (${campus.campusId}). Registered companies: ${campus.companies.join(", ")}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const previousCompany = targetEmployee.companyName;
    targetEmployee.companyName = trimmedCompany;
    await targetEmployee.save();

    const updatedEmployee = targetEmployee.toObject() as Record<string, any>;
    delete updatedEmployee.passwordHash;

    // Log admin audit action
    const { logAdminActivity } = await import("@/lib/auditLogger");
    await logAdminActivity(req, session, {
      action: "EMPLOYEE_COMPANY_UPDATED" as any,
      targetEntity: "User",
      targetId: updatedEmployee.employeeId || String(updatedEmployee._id),
      targetName: updatedEmployee.name,
      details: `Reassigned company for ${updatedEmployee.name} from "${previousCompany}" to "${trimmedCompany}".`,
    });

    return NextResponse.json({
      success: true,
      message: `Employee company successfully updated to ${trimmedCompany}.`,
      employee: updatedEmployee,
    });
  } catch (error: unknown) {
    console.error("Employee company update API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update employee company." },
      { status: 500 }
    );
  }
}
