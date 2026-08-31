import mongoose, { Document, Model, Schema } from "mongoose";

export interface IRideRequest extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const RideRequestSchema = new Schema<IRideRequest>(
  {
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: [true, "Ride reference is required"],
      index: true,
    },
    passenger: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Passenger reference is required"],
      index: true,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver reference is required"],
      index: true,
    },
    pickupStop: {
      type: String,
      required: [true, "Pickup stop is required"],
      trim: true,
    },
    dropStop: {
      type: String,
      required: [true, "Drop stop is required"],
      trim: true,
    },
    seatsRequested: {
      type: Number,
      default: 1,
      min: [1, "At least 1 seat is required"],
    },
    fare: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    responseNote: {
      type: String,
      default: "",
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
      trim: true,
    },
    boardingPin: {
      type: String,
      trim: true,
      default: "",
    },
    isBoarded: {
      type: Boolean,
      default: false,
    },
    boardedAt: {
      type: Date,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partially_paid", "not_paid"],
      default: "not_paid",
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentUpdatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.RideRequest) {
  delete mongoose.models.RideRequest;
}

const RideRequest: Model<IRideRequest> =
  mongoose.models.RideRequest || mongoose.model<IRideRequest>("RideRequest", RideRequestSchema);

export default RideRequest;
