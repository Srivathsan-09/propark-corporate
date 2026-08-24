import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const notifications = await Notification.find({ recipient: session.user.id })
      .populate("sender", "name companyName profileImage")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: session.user.id,
      isRead: false,
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    console.error(" Notifications GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId, markAll } = body;

    await connectToDatabase();

    if (markAll) {
      await Notification.updateMany(
        { recipient: session.user.id, isRead: false },
        { $set: { isRead: true } }
      );
      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (notificationId) {
      await Notification.updateOne(
        { _id: notificationId, recipient: session.user.id },
        { $set: { isRead: true } }
      );
      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    return NextResponse.json(
      { success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error(" Notifications PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification status." },
      { status: 500 }
    );
  }
}
