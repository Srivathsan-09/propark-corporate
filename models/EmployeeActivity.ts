import mongoose, { Document, Model, Schema } from "mongoose";

export type ActivityType =
  | "RIDE_CREATED"
  | "RIDE_UPDATED"
  | "RIDE_CANCELLED"
  | "RIDE_JOINED"
  | "RIDE_LEFT"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "STOP_ADDED"
  | "STOP_REMOVED"
  | "VEHICLE_ADDED"
  | "VEHICLE_UPDATED"
  | "VEHICLE_REMOVED"
  | "PROFILE_UPDATED"
  | "DOCUMENT_SUBMITTED"
  | "VERIFICATION_SUBMITTED";

export type EntityType = "RIDE" | "VEHICLE" | "PROFILE" | "VERIFICATION" | "BOOKING";

export interface IEmployeeActivity extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  campusId: string;
  activityType: ActivityType;
  entityType: EntityType;
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeActivitySchema = new Schema<IEmployeeActivity>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Employee ID is required"],
      index: true,
    },
    campusId: {
      type: String,
      required: [true, "Campus ID is required"],
      uppercase: true,
      trim: true,
      index: true,
    },
    activityType: {
      type: String,
      enum: [
        "RIDE_CREATED",
        "RIDE_UPDATED",
        "RIDE_CANCELLED",
        "RIDE_JOINED",
        "RIDE_LEFT",
        "RIDE_STARTED",
        "RIDE_COMPLETED",
        "STOP_ADDED",
        "STOP_REMOVED",
        "VEHICLE_ADDED",
        "VEHICLE_UPDATED",
        "VEHICLE_REMOVED",
        "PROFILE_UPDATED",
        "DOCUMENT_SUBMITTED",
        "VERIFICATION_SUBMITTED",
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["RIDE", "VEHICLE", "PROFILE", "VERIFICATION", "BOOKING"],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Performance Indexes for fast multi-filter audit retrieval
EmployeeActivitySchema.index({ employee: 1, timestamp: -1 });
EmployeeActivitySchema.index({ campusId: 1, timestamp: -1 });
EmployeeActivitySchema.index({ activityType: 1, timestamp: -1 });
EmployeeActivitySchema.index({ entityId: 1, timestamp: -1 });

if (process.env.NODE_ENV === "development" && mongoose.models.EmployeeActivity) {
  delete (mongoose.models as any).EmployeeActivity;
}

const EmployeeActivity: Model<IEmployeeActivity> =
  mongoose.models.EmployeeActivity ||
  mongoose.model<IEmployeeActivity>("EmployeeActivity", EmployeeActivitySchema);

export default EmployeeActivity;
