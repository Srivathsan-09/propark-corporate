import mongoose from "mongoose";
import EmployeeActivity, { ActivityType, EntityType } from "@/models/EmployeeActivity";
import { connectToDatabase } from "@/lib/db/mongodb";

interface LogActivityParams {
  employeeId: string | mongoose.Types.ObjectId;
  campusId?: string;
  activityType: ActivityType;
  entityType: EntityType;
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * CommuteX Structured Employee Activity Logger
 * Records meaningful business actions without blocking primary request flow.
 */
export async function logEmployeeActivity({
  employeeId,
  campusId,
  activityType,
  entityType,
  entityId,
  description,
  metadata = {},
  timestamp,
}: LogActivityParams): Promise<void> {
  try {
    if (!employeeId) return;
    await connectToDatabase();

    await EmployeeActivity.create({
      employee: employeeId,
      campusId: campusId || "CAMP001",
      activityType,
      entityType,
      entityId,
      description,
      metadata,
      timestamp: timestamp || new Date(),
    });
  } catch (err) {
    console.warn(" Failed to log employee activity audit event:", err);
  }
}
