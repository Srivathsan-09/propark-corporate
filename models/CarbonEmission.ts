import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPassengerCarbonRecord {
  userId: mongoose.Types.ObjectId;
  pickupStop: string;
  dropStop: string;
  soloDistanceKm: number;
  soloEmissionKg: number;
  emissionFactorUsed: {
    gramsCO2PerKm: number;
    source: string;
    isDefault: boolean;
  };
}

export interface ICarbonEmission extends Document {
  _id: mongoose.Types.ObjectId;
  rideId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  campusId?: string;
  passengers: IPassengerCarbonRecord[];
  soloBaselineDistanceKm: number;
  actualCarpoolDistanceKm: number;
  soloBaselineCO2Kg: number;
  actualCarpoolCO2Kg: number;
  co2SavedKg: number;
  grossDifferenceKg: number;
  co2ReductionPercentage: number;
  vehicleKilometersReduced: number;
  occupancy: number;
  passengerCount: number;
  emissionFactor: {
    vehicleType: string;
    fuelType: string;
    engineCategory: string;
    gramsCO2PerKm: number;
    source: string;
    isDefault: boolean;
  };
  distanceSource: "GPS_TRACKED" | "ROUTE_ESTIMATED";
  calculationMethod: string;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PassengerCarbonRecordSchema = new Schema<IPassengerCarbonRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pickupStop: {
      type: String,
      default: "",
    },
    dropStop: {
      type: String,
      default: "",
    },
    soloDistanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    soloEmissionKg: {
      type: Number,
      required: true,
      min: 0,
    },
    emissionFactorUsed: {
      gramsCO2PerKm: { type: Number, required: true },
      source: { type: String, default: "" },
      isDefault: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const CarbonEmissionSchema = new Schema<ICarbonEmission>(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    campusId: {
      type: String,
      default: "CAMP001",
      uppercase: true,
      trim: true,
      index: true,
    },
    passengers: {
      type: [PassengerCarbonRecordSchema],
      default: [],
    },
    soloBaselineDistanceKm: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    actualCarpoolDistanceKm: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    soloBaselineCO2Kg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    actualCarpoolCO2Kg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    co2SavedKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    grossDifferenceKg: {
      type: Number,
      required: true,
      default: 0,
    },
    co2ReductionPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    vehicleKilometersReduced: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    occupancy: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    passengerCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    emissionFactor: {
      vehicleType: { type: String, default: "Car" },
      fuelType: { type: String, default: "Petrol" },
      engineCategory: { type: String, default: "default" },
      gramsCO2PerKm: { type: Number, required: true },
      source: { type: String, default: "IPCC 2006 / MoEFCC India GHG Platform" },
      isDefault: { type: Boolean, default: false },
    },
    distanceSource: {
      type: String,
      enum: ["GPS_TRACKED", "ROUTE_ESTIMATED"],
      required: true,
      default: "ROUTE_ESTIMATED",
    },
    calculationMethod: {
      type: String,
      default: "Travel Distance (km) × Emission Factor (g CO2/km) / 1000",
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.CarbonEmission) {
  delete (mongoose.models as any).CarbonEmission;
}

const CarbonEmission: Model<ICarbonEmission> =
  mongoose.models.CarbonEmission ||
  mongoose.model<ICarbonEmission>("CarbonEmission", CarbonEmissionSchema);

export default CarbonEmission;
