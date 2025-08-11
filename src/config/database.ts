import mongoose from "mongoose";
import config from "./config";

const dbUrl = config.dbUri!;    

export async function connectToDatabase() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Connected To DB");
    } catch (error) {
        console.error("Database connection error:", error);
    }
}

