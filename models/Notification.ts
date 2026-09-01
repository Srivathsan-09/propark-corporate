import mongoose, { Document, Model, Schema } from "mongoose";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type:
    | "ride_posted"
    | "ride_started"
    | "ride_completed"
    | "ride_requested"
    | "request_accepted"
    | "request_rejected"
    | "ride_cancelled"
    | "general";
  ride?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "ride_posted",
        "ride_started",
        "ride_completed",
        "ride_requested",
        "request_accepted",
        "request_rejected",
        "ride_cancelled",
        "general",
      ],
      default: "general",
      index: true,
    },
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

if (process.env.NODE_ENV === "development" && mongoose.models.Notification) {
  delete (mongoose.models as any).Notification;
}

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
