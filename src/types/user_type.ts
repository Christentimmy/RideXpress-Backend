import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    role: 'rider' | 'driver' | 'admin';
    account_status: 'active' | 'suspended' | 'banned';
    availability_status: 'online' | 'offline' | 'on_trip' | 'away';
    is_email_verified: boolean;
    is_phone_verified: boolean;
    avatar?: string;
    address: {}[];
    location?: {
        type: 'Point';
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
        is_profile_completed: boolean;
        city: string;
        state: string;
        country: string;
    };
    rating: {
        total: number;
        avg: number;
    };
    payment_fine: number;
    createdAt: Date;
    updatedAt: Date;
}
