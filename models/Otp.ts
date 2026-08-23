import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOtp extends Document {
  email: string;
  otp: string;
  purpose: "campus_admin_assign" | "employee_registration";
  campusId?: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ["campus_admin_assign", "employee_registration"],
      default: "employee_registration",
      required: true,
    },
    campusId: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Otp: Model<IOtp> = mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);

export default Otp;
