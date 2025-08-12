import mongoose, { Document } from "mongoose";

export interface IRating extends Document {
    user: mongoose.Types.ObjectId;
    driver: mongoose.Types.ObjectId;
    rating: number;
    comment?: string;
    createdAt?: Date;
    updatedAt?: Date;
}


