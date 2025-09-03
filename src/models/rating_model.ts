import mongoose, { Schema } from "mongoose";
import { IRating } from "../types/rating_type";

const ratingSchema = new Schema<IRating>(
  {
    rideId: { type: Schema.Types.ObjectId, ref: "Ride", required: true },
    rider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true },

    riderRating: { type: Number },
    riderComment: { type: String },

    driverRating: { type: Number },
    driverComment: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IRating>("Rating", ratingSchema);
