import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role: "rider" | "driver" | "admin";
  account_status: "active" | "suspended" | "banned";
  availability_status: "online" | "offline" | "on_trip" | "away";
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatar?: string;
  address: {
    type: string;
    address: string;
    coordinates: [number, number]; // [lng, lat]
  }[];
  location?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  driverProfile: {
    carSeat: number;
    carModel: string;
    carPlate: string;
    licenseNumber: string;
    licenseExpiry: Date;
    documents: { name: string; url: string }[];
    isVerified: boolean;
    isProfileCompleted: boolean;
    city: string;
    state: string;
    country: string;
    allTrips: number;
  };
  rating: {
    total: number;
    avg: number;
  };
  one_signal_id: string;
  payment_fine: number;
  createdAt: Date;
  updatedAt: Date;
}
