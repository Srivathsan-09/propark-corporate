import mongoose, { Document, Model, Schema } from "mongoose";

export interface IEmissionFactor extends Document {
  _id: mongoose.Types.ObjectId;
  factorId: string;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  fuelType: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCategory: "<=1200cc" | ">1200cc" | "default";
  gramsCO2PerKm: number;
  source: string;
  sourceReference: string;
  isActive: boolean;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmissionFactorSchema = new Schema<IEmissionFactor>(
  {
    factorId: {
      type: String,
      required: [true, "Factor ID is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ["Car", "SUV", "Van", "Bike", "Other"],
      required: [true, "Vehicle type is required"],
      default: "Car",
      index: true,
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"],
      required: [true, "Fuel type is required"],
      default: "Petrol",
      index: true,
    },
    engineCategory: {
      type: String,
      enum: ["<=1200cc", ">1200cc", "default"],
      default: "default",
      index: true,
    },
    gramsCO2PerKm: {
      type: Number,
      required: [true, "Grams CO2 per km is required"],
      min: [0, "Grams CO2 per km cannot be negative"],
    },
    source: {
      type: String,
      required: [true, "Emission factor source is required"],
      trim: true,
      default: "IPCC 2006 / MoEFCC India GHG Platform",
    },
    sourceReference: {
      type: String,
      default: "India GHG Platform / IPCC Guidelines for National Greenhouse Gas Inventories",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.EmissionFactor) {
  delete (mongoose.models as any).EmissionFactor;
}

const EmissionFactor: Model<IEmissionFactor> =
  mongoose.models.EmissionFactor ||
  mongoose.model<IEmissionFactor>("EmissionFactor", EmissionFactorSchema);

export default EmissionFactor;
