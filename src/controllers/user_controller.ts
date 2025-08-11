import { Request, Response } from "express";
import User from "../models/user_model";


export const userController = {
    uploadProfile: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            if (!req.file) {
                res.status(400).json({ message: "No file uploaded" });
                return;
            }
            user.avatar = req.file.path;
            await user.save();
            return res.status(200).json({ message: "Profile updated successfully" });

        } catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    },

    getUserAddress: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            return res.status(200).json({ address: user.address });
        } catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    },

    saveAddress: async (req: Request, res: Response) => { 
        try {
            const { address } = req.body;
            if (!address) {
                res.status(400).json({ message: "Address is required" });
                return;
            }
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            user.address.push(address);
            await user.save();
            return res.status(200).json({ message: "Address saved successfully" });
        } catch (error) {
            return res.status(500).json({ message: "Internal server error" });

        }
    }

};