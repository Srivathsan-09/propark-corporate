import mongoose, { Document, Model, Schema } from "mongoose";

export interface IVehicle extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  availableSeats: number;
  vehiclePhoto?: string;
  numberPlatePhoto?: string;
  drivingLicensePhoto?: string;
  fuelType?: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCapacity?: string;
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
  rejectionReason?: string;
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
    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,3}\s?[0-9]{1,4}$/,
        "Registration plate number must be in standard Indian format (e.g. TN 07 AB 1234)",
      ],
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
