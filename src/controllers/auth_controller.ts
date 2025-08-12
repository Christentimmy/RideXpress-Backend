import { Request, Response } from 'express';
import User from '../models/user_model';
import bcrypt from 'bcrypt';
import generateToken from '../utils/token_generator';
import { sendOTP } from '../services/email_service';
import { redisController } from './redis_controller';

export const authController = {
    register: async (req: Request, res: Response) => {
        try {
            if (!req.body) {
                res.status(400).json({ message: "Bad request" });
                return;
            }
            const { first_name, last_name, email, password, role = "rider" } = req.body;
            if (!first_name || !last_name || !email || !password) {
                res.status(400).json({ message: "Please fill all fields" });
                return;
            }
            const exist = await User.findOne({ email });
            if (exist) {
                res.status(400).json({ message: "User already exists" });
                return;
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = new User({
                first_name,
                last_name,
                email,
                role,
                password: hashedPassword,
            });

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const success = await sendOTP(user.email, otp);
            if (!success) {
                res.status(500).json({ message: "Failed to send OTP" });
                return;
            }
            await redisController.saveOtpToStore(user.email, otp);

            const token = generateToken(user);
            await user.save();
            res.status(201).json({ message: "User registered successfully", token });
        } catch (error) {
            console.error(`AuthController:register: ${error}`);
            res.status(500).json({ message: "Server error" });
        }
    },

    login: async (req: Request, res: Response) => {
        try {
            if (!req.body) {
                res.status(400).json({ message: "Bad request" });
                return;
            }
            const { identifier, password } = req.body;
            if (!identifier || !password) {
                res.status(400).json({ message: "Please fill all fields" });
                return;
            }
            const user = await User.findOne({
                $or: [{ email: identifier }, { phone: identifier }],
            });
            if (!user) {
                res.status(400).json({ message: "Invalid credentials" });
                return;
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                res.status(400).json({ message: "Invalid credentials" });
                return;
            }
            const token = generateToken(user);
            if (!user.is_phone_verified && !user.is_email_verified) {
                res.status(400).json({ message: "Please verify your phone number or email", token });
                return;
            }

            if (user.role == "driver") {
                if (!user.driverProfile.is_profile_completed) {
                    res.status(400).json({ message: "Please complete your driver profile", token });
                    return;
                }
            }

            if (user.account_status === "suspended") {
                res.status(400).json({ message: "Your account is suspended" });
                return;
            }

            if (user.account_status === "banned") {
                res.status(400).json({ message: "Your account is banned" });
                return;
            }


            res.status(200).json({ message: "User logged in successfully", token });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
};

