import mongoose, { Schema } from "mongoose";
import { INotification } from "../types/notification_type";

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1 });

export default mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
