import { Types } from 'mongoose';
import userSchema from '../models/user_model';
import { Response, Request, NextFunction } from 'express';


export async function statusChecker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = res.locals.userId;

        const isObjectId = Types.ObjectId.isValid(userId);

        if(!isObjectId){
            res.status(400).json({message: "Invalid user id"});
            return;
        }

        const user = await userSchema.findById(userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (!user?.isEmailVerified) {
            res.status(400).send({ message: "user email is not verified" });
            return;
        }
        
        if(user.role === "driver" && !user.driverProfile.isProfileCompleted){
            res.status(400).send({ message: "user driver profile is not completed" });
            return;
        }

        if (user.account_status === 'banned') {
            res.status(400).send({ message: "Account banned" });
            return;
        }

        if(user.role === "rider" && user.payment_fine > 0){
            res.status(400).send({ message: "You have a payment fine" });
            return;
        }

        res.locals.userId = userId;
        res.locals.user = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function adminStatusChecker(req: Request, res: Response, next: NextFunction): Promise<void> {

    try {
        const userId = res.locals.userId; // Extract userId from token middleware

        if (!userId) {
            res.status(401).json({ message: "Unauthorized access" });
            return;
        }

        const user = await userSchema.findById(userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.account_status === "banned") {
            res.status(403).json({ message: "Admin account is banned" });
            return;
        }

        if (user.account_status !== 'active') {

            res.status(403).json({ message: "Admin account is not active" });
            return;
        }

        res.locals.adminId = user._id.toString();
        res.locals.admin = user;
        next();
    } catch (error) {
        console.error("Admin status check failed:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}
