import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { registerSchema } from "@/validations/auth.schema";

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
    const normalizedEmpId = employeeId.toUpperCase().trim();
    const normalizedCampusCompanyId = campusId.toUpperCase().trim();

    // 3. Import Campus Models & Validate Campus ID & Company Membership
    const CampusCompany = (await import("@/models/CampusCompany")).default;
    const campusCompany = await CampusCompany.findOne({
      campusCompanyId: normalizedCampusCompanyId,
      status: "active",
    });

    if (!campusCompany) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Campus ID "${normalizedCampusCompanyId}". Please verify and enter a valid registered CommuteX Campus ID (e.g. CAMP-ABC-001).`,
        },
        { status: 400 }
      );
    }

    // Verify company name matches the Campus ID
    const enteredCompClean = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const registeredCompClean = campusCompany.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const isCompanyMatch =
      enteredCompClean.includes(registeredCompClean) ||
      registeredCompClean.includes(enteredCompClean) ||
      enteredCompClean === registeredCompClean;

    if (!isCompanyMatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Campus ID "${normalizedCampusCompanyId}" belongs to "${campusCompany.companyName}", not "${companyName}". Please enter the correct Campus ID for your company.`,
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
    const existingEmpId = await User.findOne({ employeeId: normalizedEmpId });
    if (existingEmpId) {
      return NextResponse.json(
        {
          success: false,
          error: "An account is already registered with this Company Employee ID.",
          accountExists: true,
        },
        { status: 409 }
      );
    }

    // 6. Hash Password securely
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 7. Create User with physical Campus & Company associations
    const newUser = await User.create({
      name,
      employeeId: normalizedEmpId,
      email: normalizedEmail,
      phone,
      department,
      companyName: campusCompany.companyName,
      campusCompanyId: campusCompany.campusCompanyId,
      campusId: campusCompany.campusId,
      companyId: campusCompany.companyId,
      campusName: campusCompany.campusName,
      passwordHash,
      role: "employee",
      verificationStatus: "pending",
      isApproved: false,
    });

    // 8. Safe response
    return NextResponse.json(
      {
        success: true,
        message: `Registration successful for ${campusCompany.campusName}! Your account has been submitted for campus admin verification.`,
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          employeeId: newUser.employeeId,
          email: newUser.email,
          companyName: newUser.companyName,
          campusCompanyId: newUser.campusCompanyId,
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
        error: "An unexpected error occurred during registration. Please try again later.",
      },
      { status: 500 }
    );
  }
}
