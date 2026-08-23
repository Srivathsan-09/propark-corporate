import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  adminId?: mongoose.Types.ObjectId;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  targetName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    adminRole: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetEntity: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    targetName: {
      type: String,
      trim: true,
      default: "",
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "Browser",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.AuditLog) {
  delete mongoose.models.AuditLog;
}

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
