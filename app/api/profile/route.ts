import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";
import { updateProfileSchema } from "@/validations/profile.schema";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to view profile." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    let user = null;
    if (session.user.id && mongoose.Types.ObjectId.isValid(session.user.id)) {
      user = await User.findById(session.user.id).select("-passwordHash");
    }
    if (!user && session.user.email) {
      user = await User.findOne({ email: session.user.email.toLowerCase().trim() }).select("-passwordHash");
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: user,
    });
  } catch (error: unknown) {
    console.error(" Profile GET API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve profile data." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login to update profile." },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate request body
    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((e) => e.message);
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: errorMessages,
        },
        { status: 400 }
      );
    }

    const { name, phone, department, companyName, profileImage, homeLocation, commutePreferences } =
      validationResult.data;

    await connectToDatabase();

    // Strictly update only authorized fields belonging to the authenticated user ID
    const updatedUser = await User.findByIdAndUpdate(
      session.user.id,
      {
        $set: {
          name,
          phone,
          department,
          companyName: companyName || "Tech Mahindra",
          profileImage: profileImage || "",
          homeLocation: homeLocation || "",
          commutePreferences: commutePreferences || {},
        },
      },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "User not found for update." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      profile: updatedUser,
    });
  } catch (error: unknown) {
    console.error(" Profile PATCH API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
