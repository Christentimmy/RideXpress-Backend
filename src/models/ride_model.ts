import mongoose, { Schema } from "mongoose";
import { IRide } from "../types/ride_type";

const rideSchema = new Schema<IRide>(
  {
    rider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: [
        "pending",
        "arrived",
        "accepted",
        "rejected",
        "cancelled",
        "completed",
        "progress",
        "paused",
        "panic",
      ],
      default: "pending",
    },
    pickup_location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    dropoff_location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    fare: { type: Number, default: 0 },
    requested_at: { type: Date, default: Date.now },
    payment_method: {
      type: String,
      enum: ["cash", "stripe"],
      default: "cash",
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    transaction_id: { type: String, default: null },
    amount_paid: { type: Number, default: 0 },
    excluded_drivers: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    invited_drivers: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    rated_by_rider: { type: Boolean, default: false },
    rated_by_driver: { type: Boolean, default: false },
    stops: [
      {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String },
      },
    ],
  },
  { timestamps: true }
);

rideSchema.index({ rider: 1, status: 1 });

export default mongoose.model<IRide>("rides", rideSchema);
