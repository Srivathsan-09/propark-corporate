import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Campus from "@/models/Campus";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();

    await connectToDatabase();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { campusId: id.toUpperCase().trim() };

    const campus = await Campus.findOne(query);
    if (!campus) {
      return NextResponse.json(
        { success: false, error: "Campus not found." },
        { status: 404 }
      );
    }

    // Support adding a company, removing a company, or updating full fields
    if (body.action === "add_company" && body.companyName) {
      const trimmed = body.companyName.trim();
      if (!campus.companies.includes(trimmed)) {
        campus.companies.push(trimmed);
        await campus.save();
      }
      return NextResponse.json({
        success: true,
        message: `Company "${trimmed}" added to ${campus.name}.`,
        campus,
      });
    }

    if (body.action === "remove_company" && body.companyName) {
      const trimmed = body.companyName.trim();
      campus.companies = campus.companies.filter((c) => c !== trimmed);
      await campus.save();
      return NextResponse.json({
        success: true,
        message: `Company "${trimmed}" removed from ${campus.name}.`,
        campus,
      });
    }

    // Full field updates
    if (body.name) campus.name = body.name.trim();
    if (body.address) campus.address = body.address.trim();
    if (body.city) campus.city = body.city.trim();
    if (body.state) campus.state = body.state.trim();
    if (body.status) campus.status = body.status;
    if (Array.isArray(body.companies)) {
      campus.companies = body.companies.map((c: string) => c.trim()).filter(Boolean);
    }

    await campus.save();

    return NextResponse.json({
      success: true,
      message: `Campus "${campus.name}" updated successfully.`,
      campus,
    });
  } catch (error: unknown) {
    console.error("Admin Campus PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update campus." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = params;
    await connectToDatabase();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { campusId: id.toUpperCase().trim() };

    const deleted = await Campus.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Campus not found for deletion." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Campus "${deleted.name}" (${deleted.campusId}) deleted successfully.`,
    });
  } catch (error: unknown) {
    console.error("Admin Campus DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete campus." },
      { status: 500 }
    );
  }
}
