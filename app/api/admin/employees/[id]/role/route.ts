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

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only Super Administrators can change user roles." },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid user identifier." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { role, campusId } = body;

    if (role !== "employee" && role !== "campus_admin") {
      return NextResponse.json(
        { success: false, error: "Invalid role specified. Must be 'employee' or 'campus_admin'." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // Do not allow changing the primary Super Admin account
    if (user.email === "srimana2006@gmail.com") {
      return NextResponse.json(
        { success: false, error: "Cannot modify primary Super Admin role." },
        { status: 400 }
      );
    }

    if (role === "campus_admin") {
      if (!campusId) {
        return NextResponse.json(
          { success: false, error: "Please specify which Campus this administrator will manage." },
          { status: 400 }
        );
      }

      const campus = await Campus.findOne({ campusId: campusId.toUpperCase().trim() });
      if (!campus) {
        return NextResponse.json(
          { success: false, error: "Target campus does not exist." },
          { status: 404 }
        );
      }

      user.role = "campus_admin";
      user.campusId = campus.campusId;
      user.campusName = campus.name;
      user.isApproved = true;
      user.verificationStatus = "approved";
      await user.save();

      // Update the campus adminEmail
      campus.adminEmail = user.email.toLowerCase().trim();
      await campus.save();

      return NextResponse.json({
        success: true,
        message: "User " + user.name + " promoted to Campus Admin for " + campus.name + " (" + campus.campusId + ").",
        user,
      });
    }

    if (role === "employee") {
      user.role = "employee";
      await user.save();

      // Remove from any campus adminEmail if previously assigned
      await Campus.updateMany(
        { adminEmail: user.email.toLowerCase().trim() },
        { $unset: { adminEmail: "" } }
      );

      return NextResponse.json({
        success: true,
        message: "User " + user.name + " role changed to regular Employee.",
        user,
      });
    }
  } catch (error) {
    console.error("User role change API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user role." },
      { status: 500 }
    );
  }
}
