import mongoose, { Document, Model, Schema } from "mongoose";
import "./User";

export interface IHubPoint {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface IHub extends Document {
  _id: mongoose.Types.ObjectId;
  hubId: string;
  name: string;
  corridor: string;
  origin: IHubPoint;
  commonPoint?: IHubPoint | null;
  intermediatePoints?: IHubPoint[];
  destination: IHubPoint;
  campusId: string;
  campusName: string;
  routeCoordinates: [number, number][]; // [[lat, lng], ...]
  distanceKm: number;
  durationMinutes: number;
  status: "active" | "inactive";
  createdBy: mongoose.Types.ObjectId;
  createdByName: string;
  createdByRole: string;
  createdAt: Date;
  updatedAt: Date;
}

const HubPointSchema = new Schema<IHubPoint>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

const HubSchema = new Schema<IHub>(
  {
    hubId: {
      type: String,
      required: [true, "Hub ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Hub name is required"],
      trim: true,
      index: true,
    },
    corridor: {
      type: String,
      required: [true, "Corridor label is required"],
      trim: true,
      index: true,
    },
    origin: {
      type: HubPointSchema,
      required: [true, "Hub origin is required"],
    },
    commonPoint: {
      type: HubPointSchema,
      default: null,
      required: false,
    },
    intermediatePoints: {
      type: [HubPointSchema],
      default: [],
    },
    destination: {
      type: HubPointSchema,
      required: [true, "Hub destination is required"],
    },
    campusId: {
      type: String,
      required: [true, "Campus ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    campusName: {
      type: String,
      default: "",
      trim: true,
    },
    routeCoordinates: {
      type: [[Number]],
      default: [],
    },
    distanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      default: "Administrator",
      trim: true,
    },
    createdByRole: {
      type: String,
      enum: ["admin", "campus_admin"],
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.Hub) {
  delete (mongoose.models as any).Hub;
}

const Hub: Model<IHub> = mongoose.models.Hub || mongoose.model<IHub>("Hub", HubSchema);

export default Hub;
