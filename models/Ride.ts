import mongoose, { Document, Model, Schema } from "mongoose";
import "./User";
import "./Vehicle";

export interface IRideStop {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  price: number;
  estimatedTime?: string;
}

export interface ILocationCoordinate {
  address: string;
  latitude: number;
  longitude: number;
}

export interface ILiveDriverLocation {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number;
  lastUpdated: Date;
}

export interface IRidePassengerRequest {
  _id: mongoose.Types.ObjectId;
  ride: mongoose.Types.ObjectId;
  passenger: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  pickupStop: string;
  dropStop: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  responseNote?: string;
  idempotencyKey?: string;
  boardingPin?: string;
  isBoarded?: boolean;
  boardedAt?: Date;
  paymentStatus?: "paid" | "partially_paid" | "not_paid";
  amountPaid?: number;
  paymentUpdatedAt?: Date;
  currentLocation?: ILiveDriverLocation;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRide extends Document {
  _id: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  vehicle: mongoose.Types.ObjectId;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  rideType: "pickup" | "drop";
  startingLocation: string;
  destination: string;
  startLocation?: ILocationCoordinate;
  endLocation?: ILocationCoordinate;
  currentLocation?: ILiveDriverLocation;
  startedAt?: Date;
  completedAt?: Date;
  distanceKm?: number;
  durationMinutes?: number;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  basePrice: number;
  stops: IRideStop[];
  notes?: string;
  campusId?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  acceptedPassengers: mongoose.Types.ObjectId[];
  requests: IRidePassengerRequest[];
  createdAt: Date;
  updatedAt: Date;
}

const LocationCoordinateSchema = new Schema<ILocationCoordinate>(
  {
    address: { type: String, default: "" },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
  },
  { _id: false }
);

const LiveDriverLocationSchema = new Schema<ILiveDriverLocation>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RideStopSchema = new Schema<IRideStop>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    price: { type: Number, required: true, min: 0 },
    estimatedTime: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const RideRequestSubSchema = new Schema<IRidePassengerRequest>(
  {
    ride: { type: Schema.Types.ObjectId, ref: "Ride", required: true },
    passenger: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pickupStop: { type: String, required: true, trim: true },
    dropStop: { type: String, required: true, trim: true },
    seatsRequested: { type: Number, default: 1, min: 1 },
    fare: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    responseNote: { type: String, default: "" },
    idempotencyKey: { type: String, default: "" },
    boardingPin: { type: String, default: "" },
    isBoarded: { type: Boolean, default: false },
    boardedAt: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ["paid", "partially_paid", "not_paid"],
      default: "not_paid",
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentUpdatedAt: { type: Date, default: null },
    currentLocation: { type: LiveDriverLocationSchema, default: null },
  },
  { timestamps: true }
);

const RideSchema = new Schema<IRide>(
  {
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"],
      index: true,
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: [true, "Vehicle is required"],
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ["Car", "SUV", "Van", "Bike", "Other"],
      required: true,
      default: "Car",
    },
    rideType: {
      type: String,
      enum: ["pickup", "drop"],
      required: true,
      default: "pickup",
      index: true,
    },
    startingLocation: {
      type: String,
      required: [true, "Starting location is required"],
      trim: true,
      index: true,
    },
    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
      index: true,
    },
    startLocation: {
      type: LocationCoordinateSchema,
      default: () => ({ address: "", latitude: 0, longitude: 0 }),
    },
    endLocation: {
      type: LocationCoordinateSchema,
      default: () => ({ address: "", latitude: 0, longitude: 0 }),
    },
    currentLocation: {
      type: LiveDriverLocationSchema,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    distanceKm: {
      type: Number,
      default: 0,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    departureDate: {
      type: String,
      required: [true, "Departure date is required"],
      index: true,
    },
    departureTime: {
      type: String,
      required: [true, "Departure time is required"],
    },
    totalSeats: {
      type: Number,
      required: [true, "Total seats are required"],
      min: [1, "At least 1 seat is required"],
    },
    availableSeats: {
      type: Number,
      required: [true, "Available seats are required"],
      min: [0, "Available seats cannot be negative"],
    },
    basePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stops: {
      type: [RideStopSchema],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    campusId: {
      type: String,
      default: "CAMP001",
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },

    acceptedPassengers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    requests: {
      type: [RideRequestSubSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.Ride) {
  delete (mongoose.models as any).Ride;
}

const Ride: Model<IRide> = mongoose.models.Ride || mongoose.model<IRide>("Ride", RideSchema);

export default Ride;
