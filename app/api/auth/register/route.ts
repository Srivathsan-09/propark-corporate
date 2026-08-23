import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { registerSchema } from "@/validations/auth.schema";
import { formatEmployeeId } from "@/lib/db/employeeSequence";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Zod Validation
    const validationResult = registerSchema.safeParse(body);
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

    const { name, employeeId, email, phone, department, companyName, campusId, password } = validationResult.data;

    // 2. Connect Database
    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCampusId = campusId.toUpperCase().trim();
    const formattedEmpId = formatEmployeeId(employeeId);

    // 3. Import Campus Model & Validate Campus ID & Company Membership
    const Campus = (await import("@/models/Campus")).default;
    const campus = await Campus.findOne({
      campusId: normalizedCampusId,
      status: "active",
    });

    if (!campus) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Campus ID "${normalizedCampusId}". Please enter a valid registered Campus ID (e.g. CAMP001, CAMP002, CAMP003).`,
        },
        { status: 400 }
      );
    }

    // Verify company name is registered at this campus
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

    // 4. Check duplicate Email
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

    // 5. Check duplicate Company ID / Employee ID
    const existingEmpId = await User.findOne({ employeeId: formattedEmpId });
    if (existingEmpId) {
      return NextResponse.json(
        {
          success: false,
          error: `Employee ID "${formattedEmpId}" is already registered. Please enter your unique ID.`,
          accountExists: true,
        },
        { status: 409 }
      );
    }

    // 6. Verify 6-digit email OTP
    const { otp } = body;
    if (!otp || !otp.trim()) {
      return NextResponse.json(
        { success: false, error: "6-digit email verification code is required." },
        { status: 400 }
      );
    }

    const Otp = (await import("@/models/Otp")).default;
    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: "employee_registration",
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: "No verification code was requested for this email. Please request a verification code." },
        { status: 400 }
      );
    }

    if (new Date() > otpRecord.expiresAt) {
      return NextResponse.json(
        { success: false, error: "Verification code has expired. Please request a new verification code." },
        { status: 400 }
      );
    }

    if (otpRecord.otp.trim() !== otp.trim()) {
      return NextResponse.json(
        { success: false, error: "Invalid 6-digit verification code. Please check your inbox or request a new code." },
        { status: 400 }
      );
    }

    // Consume OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    // 7. Hash Password securely
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 8. Create User with physical Campus & Company associations
    const newUser = await User.create({
      name,
      employeeId: formattedEmpId,
      email: normalizedEmail,
      phone,
      department,
      companyName: matchedCompany,
      campusId: campus.campusId,
      campusName: campus.name,
      passwordHash,
      role: "employee",
      verificationStatus: "pending",
      isApproved: false,
    });

    // 9. Safe response
    return NextResponse.json(
      {
        success: true,
        message: `Registration successful for ${campus.name}! Your account has been submitted for campus admin verification.`,
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          employeeId: newUser.employeeId,
          email: newUser.email,
          companyName: newUser.companyName,
          campusId: newUser.campusId,
          campusName: newUser.campusName,
          department: newUser.department,
          role: newUser.role,
          verificationStatus: newUser.verificationStatus,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("❌ Registration API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register user. Please try again.",
      },
      { status: 500 }
    );
  }
}
