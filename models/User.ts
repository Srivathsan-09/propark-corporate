import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICommutePreferences {
  departureTimePreference?: string;
  notes?: string;
  smokingPreference?: boolean;
  musicPreference?: boolean;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  companyName: string;
  campusCompanyId?: string; // Unique Campus ID (e.g. "CAMP-ABC-001")
  campusId?: string;        // Physical Campus (e.g. "CAMP001")
  companyId?: string;       // Corporate Entity (e.g. "COMP001")
  campusName?: string;      // Physical Campus Name (e.g. "Tech Park Chennai")
  passwordHash: string;
  role: "employee" | "admin" | "campus_admin";
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
  rejectionReason?: string;
  profileImage?: string;
  drivingLicensePhoto?: string;
  homeLocation?: string;
  commutePreferences?: ICommutePreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Corporate email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    department: {
      type: String,
      default: "General",
      trim: true,
    },
    companyName: {
      type: String,
      default: "ABC Technologies",
      trim: true,
      index: true,
    },
    campusCompanyId: {
      type: String,
      default: "CAMP-ABC-001",
      uppercase: true,
      trim: true,
      index: true,
    },
    campusId: {
      type: String,
      default: "CAMP001",
      uppercase: true,
      trim: true,
      index: true,
    },
    companyId: {
      type: String,
      default: "COMP001",
      uppercase: true,
      trim: true,
      index: true,
    },
    campusName: {
      type: String,
      default: "Tech Park Chennai",
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
      default: "",
      select: false, // Prevents leaking passwordHash in general queries
    },
    role: {
      type: String,
      enum: ["employee", "admin", "campus_admin"],
      default: "employee",
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    drivingLicensePhoto: {
      type: String,
      default: "",
    },
    homeLocation: {
      type: String,
      default: "",
      trim: true,
    },
    commutePreferences: {
      departureTimePreference: { type: String, default: "" },
      notes: { type: String, default: "" },
      smokingPreference: { type: Boolean, default: false },
      musicPreference: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent stale model cache in development / hot reload
if (process.env.NODE_ENV === "development" && mongoose.models.User) {
  delete (mongoose.models as any).User;
}
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
