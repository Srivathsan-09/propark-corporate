import mongoose, { Document, Model, Schema } from "mongoose";

export type VehicleVerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "PENDING"
  | "VERIFICATION_IN_PROGRESS"
  | "VERIFIED"
  | "MANUAL_REVIEW"
  | "REJECTED"
  | "VERIFICATION_FAILED";

export interface IVehicle extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  make?: string;
  vehicleModel: string;
  color?: string;
  registrationNumber: string;
  normalizedRegistrationNumber?: string;
  seatingCapacity: number;
  availableSeats: number;
  vehiclePhoto?: string;
  numberPlatePhoto?: string;
  drivingLicensePhoto?: string;
  drivingLicenseNumber?: string;
  drivingLicenseDob?: string;
  chassisNumber?: string;
  engineNumber?: string;
  drivingLicenseStatus?: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "ERROR";
  drivingLicenseVerifiedAt?: Date;
  drivingLicenseMessageCode?: string;
  drivingLicenseOrderId?: string;
  drivingLicenseClasses?: string[];
  drivingLicenseData?: Record<string, any>;
  rcProviderStatus?: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "ERROR";
  rcStatus?: string;
  rcVerifiedAt?: Date;
  rcMessageCode?: string;
  rcOrderId?: string;
  vehicleMatchStatus?: "NOT_CHECKED" | "MATCHED" | "MISMATCH" | "MANUAL_REVIEW";
  licenseVehicleClassStatus?: "NOT_CHECKED" | "COMPATIBLE" | "INCOMPATIBLE";
  commutexVehicleVerificationStatus?: "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" | "FAILED";
  adminApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  finalDriverStatus?: "NOT_SUBMITTED" | "PENDING_VERIFICATION" | "PENDING_ADMIN_REVIEW" | "VERIFIED" | "REJECTED";
  fuelType?: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCapacity?: string;
  verificationStatus: VehicleVerificationStatus;
  isApproved: boolean;
  verificationProvider?: string;
  verificationReference?: string;
  verificationCheckedAt?: Date;
  verifiedAt?: Date;
  verificationNotes?: string;
  rejectionReason?: string;
  rcData?: {
    rcNumber?: string;
    rcStatus?: string;
    makerDescription?: string;
    makerModel?: string;
    vehicleCategory?: string;
    bodyType?: string;
    fuelType?: string;
    color?: string;
    registrationDate?: string;
    fitnessUpto?: string;
    insuranceUpto?: string;
    insuranceCompany?: string;
    mismatchDetails?: string[];
  };
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vehicle owner is required"],
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ["Car", "SUV", "Van", "Bike", "Other"],
      default: "Car",
      required: [true, "Vehicle type is required"],
    },
    make: {
      type: String,
      default: "",
      trim: true,
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"],
      default: "Petrol",
    },
    engineCapacity: {
      type: String,
      default: "",
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: [true, "Vehicle model is required"],
      trim: true,
      maxlength: [100, "Vehicle model cannot exceed 100 characters"],
    },
    color: {
      type: String,
      default: "",
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{1,4}$/,
        "Registration plate number must be in standard Indian format (e.g. TN 07 AB 1234)",
      ],
      index: true,
    },
    normalizedRegistrationNumber: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    seatingCapacity: {
      type: Number,
      required: [true, "Seating capacity is required"],
      min: [1, "Seating capacity must be at least 1"],
      max: [20, "Seating capacity cannot exceed 20"],
    },
    availableSeats: {
      type: Number,
      required: [true, "Available seats are required"],
      min: [1, "Available seats must be at least 1"],
      validate: {
        validator: function (this: any, val: number) {
          if (this && typeof this.seatingCapacity === "number") {
            return val <= this.seatingCapacity;
          }
          const update = this?.getUpdate?.();
          const cap = update?.seatingCapacity ?? update?.$set?.seatingCapacity;
          if (typeof cap === "number") {
            return val <= cap;
          }
          return true;
        },
        message: "Available seats cannot exceed total seating capacity",
      },
    },
    vehiclePhoto: {
      type: String,
      default: "",
    },
    numberPlatePhoto: {
      type: String,
      default: "",
    },
    drivingLicensePhoto: {
      type: String,
      default: "",
    },
    drivingLicenseNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    drivingLicenseDob: {
      type: String,
      default: "",
      trim: true,
    },
    chassisNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    engineNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    drivingLicenseStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "FAILED", "ERROR"],
      default: "NOT_STARTED",
      index: true,
    },
    drivingLicenseVerifiedAt: {
      type: Date,
    },
    drivingLicenseMessageCode: {
      type: String,
      default: "",
    },
    drivingLicenseOrderId: {
      type: String,
      default: "",
    },
    drivingLicenseClasses: {
      type: [String],
      default: [],
    },
    drivingLicenseData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    rcProviderStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "FAILED", "ERROR"],
      default: "NOT_STARTED",
      index: true,
    },
    rcStatus: {
      type: String,
      default: "NOT_STARTED",
      index: true,
    },
    rcVerifiedAt: {
      type: Date,
    },
    rcMessageCode: {
      type: String,
      default: "",
    },
    rcOrderId: {
      type: String,
      default: "",
    },
    vehicleMatchStatus: {
      type: String,
      enum: ["NOT_CHECKED", "MATCHED", "MISMATCH", "MANUAL_REVIEW"],
      default: "NOT_CHECKED",
      index: true,
    },
    licenseVehicleClassStatus: {
      type: String,
      enum: ["NOT_CHECKED", "COMPATIBLE", "INCOMPATIBLE"],
      default: "NOT_CHECKED",
      index: true,
    },
    commutexVehicleVerificationStatus: {
      type: String,
      enum: ["PENDING", "MANUAL_REVIEW", "VERIFIED", "REJECTED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    adminApprovalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    finalDriverStatus: {
      type: String,
      enum: [
        "NOT_SUBMITTED",
        "PENDING_VERIFICATION",
        "PENDING_ADMIN_REVIEW",
        "VERIFIED",
        "REJECTED",
      ],
      default: "NOT_SUBMITTED",
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "PENDING",
        "VERIFICATION_IN_PROGRESS",
        "VERIFIED",
        "MANUAL_REVIEW",
        "REJECTED",
        "VERIFICATION_FAILED",
      ],
      default: "PENDING",
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationProvider: {
      type: String,
      default: "way2api",
    },
    verificationReference: {
      type: String,
      default: "",
    },
    verificationCheckedAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    verificationNotes: {
      type: String,
      default: "",
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    rcData: {
      type: Schema.Types.Mixed,
      default: {},
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

if (process.env.NODE_ENV === "development" && mongoose.models.Vehicle) {
  delete (mongoose.models as any).Vehicle;
}
const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle || mongoose.model<IVehicle>("Vehicle", VehicleSchema);

export default Vehicle;
