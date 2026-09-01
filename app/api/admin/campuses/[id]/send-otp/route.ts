import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";
import { sendCampusAdminOtpEmail } from "@/lib/email";

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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid corporate email address." },
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

    // Generate secure 6-digit OTP code (100000 - 999999)
    const numericOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    campus.adminEmail = email;
    campus.adminOtpCode = numericOtp;
    campus.adminOtpExpiresAt = expiresAt;
    campus.adminOtpVerified = false;
    await campus.save();

    // Send email with anti-spam primary inbox optimization
    const emailResult = await sendCampusAdminOtpEmail({
      email,
      otp: numericOtp,
      campusName: campus.name,
      campusId: campus.campusId,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, error: emailResult.error || "Failed to dispatch verification email." },
        { status: 500 }
      );
    }

    const methodMessage =
      emailResult.method === "resend"
        ? `Verification code dispatched via Resend to ${email}.`
        : emailResult.method === "gmail"
        ? `Verification code dispatched via Gmail to ${email}.`
        : emailResult.method === "smtp"
        ? `Verification code sent via SMTP to ${email}.`
        : `Verification code generated for ${email}.`;

    return NextResponse.json({
      success: true,
      message: methodMessage,
      method: emailResult.method,
      devOtp: emailResult.devOtp,
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send verification code." },
      { status: 500 }
    );
  }
}
