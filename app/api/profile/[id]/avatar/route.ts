import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    if (!id || (!mongoose.Types.ObjectId.isValid(id) && id.length !== 24)) {
      return new NextResponse("Invalid user identifier", { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(id).select("profileImage").lean();

    if (!user || !user.profileImage) {
      return new NextResponse("Avatar Not Found", { status: 404 });
    }

    // If external URL (e.g. Google avatar), redirect directly
    if (user.profileImage.startsWith("http")) {
      return NextResponse.redirect(user.profileImage);
    }

    // Parse base64 data URL: data:image/jpeg;base64,....
    const matches = user.profileImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return new NextResponse("Invalid avatar format", { status: 400 });
    }

    const contentType = matches[1];
    const imageBuffer = Buffer.from(matches[2], "base64");

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("User avatar streaming error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
