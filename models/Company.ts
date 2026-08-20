import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICompany extends Document {
  name: string;
  campusId: string;
  campusName: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    campusId: {
      type: String,
      required: [true, "Campus ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    campusName: {
      type: String,
      required: [true, "Campus name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index so a company name is unique per campus
CompanySchema.index({ campusId: 1, name: 1 }, { unique: true });

const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema, "companies");

export default Company;
