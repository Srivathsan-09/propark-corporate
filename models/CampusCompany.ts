import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICampusCompany extends Document {
  _id: mongoose.Types.ObjectId;
  campusCompanyId: string; // e.g. "CAMP-ABC-001" (The Unique Campus ID)
  campusId: string;        // e.g. "CAMP001"
  companyId: string;       // e.g. "COMP001"
  companyName: string;     // e.g. "ABC Technologies"
  campusName: string;      // e.g. "Tech Park Chennai"
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const CampusCompanySchema = new Schema<ICampusCompany>(
  {
    campusCompanyId: {
      type: String,
      required: [true, "Campus Company ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    campusId: {
      type: String,
      required: [true, "Campus ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.CampusCompany) {
  delete (mongoose.models as any).CampusCompany;
}

const CampusCompany: Model<ICampusCompany> =
  mongoose.models.CampusCompany ||
  mongoose.model<ICampusCompany>("CampusCompany", CampusCompanySchema);

export default CampusCompany;
