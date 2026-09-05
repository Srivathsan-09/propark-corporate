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
