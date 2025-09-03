import mongoose, { Document } from "mongoose";

export interface IRating extends Document {
    rider: mongoose.Types.ObjectId;
    driver: mongoose.Types.ObjectId;
    rideId: mongoose.Types.ObjectId;
    riderRating: number;
    riderComment?: string;

    driverRating: number;
    driverComment?: string;
    
    createdAt?: Date;
    updatedAt?: Date;
}


