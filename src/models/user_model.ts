import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/user_type";

const UserSchema = new Schema<IUser>({
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  account_status: {
    type: String,
    enum: ["active", "suspended", "banned"],
    default: "active",
  },
  availability_status: {
    type: String,
    enum: ["online", "offline", "on_trip", "away"],
    default: "online",
  },
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  email: { type: String, unique: true, sparse: true, lowercase: true },
  phone: { type: String, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["rider", "driver", "admin"], default: "rider" },
  avatar: { type: String },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }, //lng,lat
  },
  driverProfile: {
    carSeat: { type: Number, default: 0 },
    carModel: { type: String, default: "" },
    carPlate: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    licenseExpiry: { type: Date, default: Date.now },
    documents: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    isVerified: { type: Boolean, default: false },
    isProfileCompleted: { type: Boolean, default: false },
    allTrips: { type: Number, default: 0 },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
  },
  rating: {
    total: { type: Number, default: 0 },
    avg: { type: Number, default: 0 },
  },
  address: [
    {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      coordinates: { type: [Number], default: [0, 0] }, //lng,lat
    },
  ],
  one_signal_id: { type: String, default: "" },
  payment_fine: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.index({ location: "2dsphere" });

export default mongoose.model<IUser>("User", UserSchema);
