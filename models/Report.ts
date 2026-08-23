import mongoose, { Document, Model, Schema } from "mongoose";

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  reportId: string;
  reporter: mongoose.Types.ObjectId;
  reporterName: string;
  reporterEmail: string;
  reporterPhone?: string;
  reporterCampusId?: string;
  reporterCompany?: string;
  involvedUser?: mongoose.Types.ObjectId;
  involvedUserName?: string;
  ride?: mongoose.Types.ObjectId;
  category:
    | "rash_driving"
    | "harassment"
    | "route_deviation"
    | "vehicle_condition"
    | "payment_dispute"
    | "safety_violation"
    | "other";
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description: string;
  status: "pending" | "in_investigation" | "resolved" | "dismissed";
  resolutionNotes?: string;
  actionTaken?:
    | "none"
    | "warning_issued"
    | "account_suspended"
    | "ride_cancelled"
    | "resolved_amicably";
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter reference is required"],
      index: true,
    },
    reporterName: {
      type: String,
      required: true,
      trim: true,
    },
    reporterEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    reporterPhone: {
      type: String,
      trim: true,
    },
    reporterCampusId: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    reporterCompany: {
      type: String,
      trim: true,
    },
    involvedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    involvedUserName: {
      type: String,
      trim: true,
    },
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
    },
    category: {
      type: String,
      enum: [
        "rash_driving",
        "harassment",
        "route_deviation",
        "vehicle_condition",
        "payment_dispute",
        "safety_violation",
        "other",
      ],
      default: "other",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    title: {
      type: String,
      required: [true, "Report title is required"],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, "Report description is required"],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "in_investigation", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    actionTaken: {
      type: String,
      enum: [
        "none",
        "warning_issued",
        "account_suspended",
        "ride_cancelled",
        "resolved_amicably",
      ],
      default: "none",
    },
    resolvedBy: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.Report) {
  delete mongoose.models.Report;
}

const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

export default Report;
