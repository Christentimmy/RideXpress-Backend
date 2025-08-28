import mongoose, { Schema } from "mongoose";
import { IRating } from "../types/rating_type";

const ratingSchema = new Schema<IRating>({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    driver: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    rideId: {
        type: Schema.Types.ObjectId,
        ref: "Ride",
    },
    rating: {
        type: Number,
        required: true,
    },
    comment: {
        type: String,
    },
}, {
    timestamps: true,
});

export default mongoose.model<IRating>("Rating", ratingSchema);
