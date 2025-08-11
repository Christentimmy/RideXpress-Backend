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

};