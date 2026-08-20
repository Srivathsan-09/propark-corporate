import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICampus extends Document {
  _id: mongoose.Types.ObjectId;
  campusId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const CampusSchema = new Schema<ICampus>(
  {
    campusId: {
      type: String,
      required: [true, "Campus ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Campus name is required"],
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, "Campus address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
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

if (process.env.NODE_ENV === "development" && mongoose.models.Campus) {
  delete (mongoose.models as any).Campus;
}

const Campus: Model<ICampus> =
  mongoose.models.Campus || mongoose.model<ICampus>("Campus", CampusSchema);

export default Campus;
