import { Document } from 'mongoose';

export interface IUser extends Document {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    role: 'rider' | 'driver' | 'admin';
    avatar?: string;
    location?: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
    };
    driverProfile?: {
        carModel: string;
        carPlate: string;
        licenseNumber: string;
        licenseExpiry: Date;
        documents: { name: string; url: string }[];
        isVerified: boolean;
    };
    rating: {
        total: number;
        count: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
