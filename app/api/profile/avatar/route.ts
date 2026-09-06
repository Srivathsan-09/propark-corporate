import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).select("profileImage").lean();

    if (!user || !user.profileImage) {
      return new NextResponse("Avatar Not Found", { status: 404 });
    }

    if (user.profileImage.startsWith("http")) {
      return NextResponse.redirect(user.profileImage);
    }

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
    console.error("Avatar GET error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
