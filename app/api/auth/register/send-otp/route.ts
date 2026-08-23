import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Campus from "@/models/Campus";
import Otp from "@/models/Otp";
import { sendRegistrationOtpEmail } from "@/lib/email";
import { formatEmployeeId } from "@/lib/db/employeeSequence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, employeeId, campusId, companyName } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Corporate email is required." },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!campusId || !campusId.trim()) {
      return NextResponse.json(
        { success: false, error: "Campus ID is required." },
        { status: 400 }
      );
    }

    if (!companyName || !companyName.trim()) {
      return NextResponse.json(
        { success: false, error: "Company / Organization is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCampusId = campusId.toUpperCase().trim();
    const formattedEmpId = employeeId ? formatEmployeeId(employeeId) : "";

    // 1. Validate Campus ID
    const campus = await Campus.findOne({
      campusId: normalizedCampusId,
      status: "active",
    });

    if (!campus) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Campus ID "${normalizedCampusId}". Please enter a valid active Campus ID (e.g. CAMP001, CAMP002, CAMP003).`,
        },
        { status: 400 }
      );
    }

    // 2. Validate Company Membership
    const enteredCompClean = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchedCompany = campus.companies.find((comp: string) => {
      const registeredCompClean = comp.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        registeredCompClean.includes(enteredCompClean) ||
        enteredCompClean.includes(registeredCompClean) ||
        registeredCompClean === enteredCompClean
      );
    });

    if (!matchedCompany) {
      return NextResponse.json(
        {
          success: false,
          error: `Company "${companyName}" does not operate at ${campus.name} (${campus.campusId}). Registered companies: ${campus.companies.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // 3. Check duplicate Email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "An account already exists with this corporate email. Please sign in instead.",
          accountExists: true,
        },
        { status: 409 }
      );
    }

    // 4. Check duplicate Employee ID if provided
    if (formattedEmpId) {
      const existingEmpId = await User.findOne({ employeeId: formattedEmpId });
      if (existingEmpId) {
        return NextResponse.json(
          {
            success: false,
            error: `Employee ID "${formattedEmpId}" is already registered. Please use your unique badge ID.`,
            accountExists: true,
          },
          { status: 409 }
        );
      }
    }

    // 5. Generate secure 6-digit OTP code
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.findOneAndUpdate(
      { email: normalizedEmail, purpose: "employee_registration" },
      {
        email: normalizedEmail,
        otp,
        purpose: "employee_registration",
        campusId: campus.campusId,
        expiresAt,
        verified: false,
      },
      { upsert: true, new: true }
    );

    // 6. Dispatch Email
    const emailResult = await sendRegistrationOtpEmail({
      email: normalizedEmail,
      otp,
      name: name.trim(),
      campusName: campus.name,
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
      expiresInMinutes: 10,
      devOtp: emailResult.devOtp,
    });
  } catch (error: any) {
    console.error("Send Registration OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch verification email. Please try again." },
      { status: 500 }
    );
  }
}
