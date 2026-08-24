import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import AuditLog from "@/models/AuditLog";

interface AuditLogPayload {
  action: string;
  targetEntity: string;
  targetId: string;
  targetName?: string;
  details: string;
}

export async function logAdminActivity(
  req: NextRequest | Request | null,
  session: any,
  payload: AuditLogPayload
) {
  try {
    if (!session || !session.user) return;

    await connectToDatabase();

    let ipAddress = "127.0.0.1";
    let userAgent = "Web Browser";

    if (req && "headers" in req) {
      const forwarded = req.headers.get("x-forwarded-for");
      ipAddress = forwarded
        ? forwarded.split(",")[0].trim()
        : req.headers.get("x-real-ip") || "127.0.0.1";
      userAgent = req.headers.get("user-agent") || "Web Browser";
    }

    await AuditLog.create({
      adminId: session.user.id || undefined,
      adminName: session.user.name || "Administrator",
      adminEmail: (session.user.email || "").toLowerCase(),
      adminRole: session.user.role || "admin",
      action: payload.action,
      targetEntity: payload.targetEntity,
      targetId: payload.targetId,
      targetName: payload.targetName || "",
      details: payload.details,
      ipAddress,
      userAgent,
    });

    console.log(` [Audit Log] ${payload.action} on ${payload.targetEntity} (${payload.targetId}) by ${session.user.email}`);
  } catch (error) {
    console.error(" [Audit Logger Error]:", error);
  }
}
