import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: string;
  name: string;
  domain?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      index: true,
    },
    domain: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.Company) {
  delete (mongoose.models as any).Company;
}

const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema);

export default Company;
