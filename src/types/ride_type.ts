
import mongoose, { Document } from "mongoose";

export interface IRide extends Document {
    rider: mongoose.Types.ObjectId;
    driver: mongoose.Types.ObjectId;
    status: "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "progress" | "paused" | "panic";
    pickup_location: { lat: number; lng: number; address: string };
    dropoff_location: { lat: number; lng: number; address: string };
    fare: number;
    requested_at: Date;
    payment_method: "cash" | "stripe";
    payment_status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
    transaction_id?: string;
    amount_paid?: number;
    excluded_drivers?: mongoose.Types.ObjectId[];
    rated_by_rider: boolean;
    rated_by_driver: boolean;
}