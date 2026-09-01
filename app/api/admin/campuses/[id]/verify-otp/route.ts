import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";
import Otp from "@/models/Otp";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Super Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    const otpCode = (body.otp || "").trim();

    if (!email || !otpCode) {
      return NextResponse.json(
        { success: false, error: "Email and 6-digit OTP are required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const idParam = decodeURIComponent(id || "").trim();
    const isObjId = mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24;

    const query = isObjId
      ? { $or: [{ _id: new mongoose.Types.ObjectId(idParam) }, { campusId: new RegExp(`^${idParam}$`, "i") }] }
      : { campusId: new RegExp(`^${idParam}$`, "i") };

    let campus = await Campus.findOne(query);
    if (!campus) {
      campus = await Campus.findOne({
        $or: [
          { campusId: idParam.toUpperCase() },
          { name: new RegExp(`^${idParam}$`, "i") },
        ],
      });
    }

    if (!campus) {
      return NextResponse.json(
        { success: false, error: "Campus not found." },
        { status: 404 }
      );
    }

    // Verify OTP record
    const validOtpDoc = await Otp.findOne({
      email,
      otp: otpCode,
      campusId: campus.campusId,
      purpose: "campus_admin_assign",
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!validOtpDoc) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired verification code. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark OTP as verified and store timestamp (retained for DB inspection)
    await Otp.updateOne({ _id: validOtpDoc._id }, { $set: { verified: true, verifiedAt: new Date() } });

    // Update Campus document
    campus.adminEmail = email;
    await campus.save();

    // If a user account already exists for this email, promote them to campus_admin
    const userDoc = await User.findOne({ email });
    if (userDoc) {
      userDoc.role = "campus_admin";
      userDoc.campusId = campus.campusId;
      userDoc.campusName = campus.name;
      userDoc.isApproved = true;
      userDoc.verificationStatus = "approved";
      await userDoc.save();
    }

    return NextResponse.json({
      success: true,
      message: `Verified successfully! Assigned "${email}" as Campus Admin for ${campus.name}.`,
      campus,
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify authorization code." },
      { status: 500 }
    );
  }
}
