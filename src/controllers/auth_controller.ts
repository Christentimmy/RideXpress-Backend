import { Request, Response } from 'express';
import User from '../models/user_model';
import bcrypt from 'bcrypt';
import generateToken from '../utils/token_generator';
import { sendOTP } from '../services/email_service';
import { redisController } from './redis_controller';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config/config';
import bcryptjs from "bcryptjs";


interface DecodedToken extends JwtPayload {
    id: string;
    role: string;
}

export const authController = {
    register: async (req: Request, res: Response) => {
        try {
            if (!req.body) {
                res.status(400).json({ message: "Bad request" });
                return;
            }
            const { first_name, last_name, email, password } = req.body;
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

    driverRegister: async (req: Request, res: Response) => {
        try {
            const { first_name, last_name, email, password, state, city } = req.body;
            if (!first_name || !last_name || !email || !password || !state || !city) {
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
                password: hashedPassword,
                role: "driver",
                driverProfile: {
                    city,
                    state,
                }
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
            console.error(error);
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

    sendOTp: async (req: Request, res: Response) => {
        try {
            const authHeader = req.header("Authorization");

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                res.status(401).json({
                    message: "Access denied. No token provided or incorrect format.",
                });
                return;
            }

            const token = authHeader.split(" ")[1];

            if (!token || token.split(".").length !== 3) {
                res.status(400).json({ message: "Invalid token format." });
                return;
            }

            let decoded: DecodedToken;
            try {
                decoded = jwt.verify(token, config.jwt.secret) as DecodedToken;

            } catch (error) {
                console.error("JWT Verification Error:", error);
                res.status(403).json({ message: "Invalid or expired token." });
                return;
            }

            const user = await User.findById(decoded.id);
            if (!user) {
                res.status(404).json({ message: "User Not Found" });
                return;
            }

            const min = Math.pow(10, 3);
            const max = Math.pow(10, 4) - 1;
            const otp: string = (
                Math.floor(Math.random() * (max - min + 1)) + min
            ).toString();


            await redisController.saveOtpToStore(user.email, otp);
            const result = await sendOTP(user.email, otp);

            if (result.success === false) {
                res
                    .status(400)
                    .json({ message: "Error sending email", data: { error: result } });
                return;
            }
            res.status(200).json({ message: "OTP sent successfully" });
        } catch (error) {
            console.error("❌ Error in sendOTP:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    verifyOTP: async (req: Request, res: Response) => {
        try {
            const { email, otp, phone_number } = req.body;

            if (!otp) {
                res.status(400).json({ message: "OTP is required" });
                return;
            }

            const user = await User.findById(res.locals.userId);
            if (!user) {
                res.status(404).json({ message: "User Not Found" });
                return;
            }

            const savedOtp = await redisController.getOtpFromStore(user.email);
            if (!savedOtp) {
                res.status(400).json({ message: "OTP not found" });
                return;
            }

            if (savedOtp !== otp) {
                res.status(400).json({ message: "Invalid OTP" });
                return;
            }

            if (email?.trim() && user.email !== email) {
                res.status(400).json({ message: "Invalid email address" });
                return;
            }

            if (email) {
                user.is_email_verified = true;
            }

            // if (phone_number && phone_number !== user.phone_number) {
            //     res.status(400).json({ message: "Invalid phone number" });
            //     return;
            // }

            if (phone_number) {
                user.phone = phone_number;
                user.is_phone_verified = true;
            }

            await user.save();
            res.status(200).json({ message: "OTP verified successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Something went wrong" });
        }
    },

    changePassword: async (req: Request, res: Response) => {
        try {
            const { old_password, new_password } = req.body;

            if (!old_password || !new_password) {
                res
                    .status(400)
                    .json({ message: "old password and new password required" });
                return;
            }
            const user = res.locals.user;
            const validatePassword = await bcryptjs.compare(
                old_password,
                user.password
            );
            if (!validatePassword) {
                res.status(400).send({ message: "Invalid password Old Password" });
                return;
            }

            const salt = await bcryptjs.genSalt(10);
            const hashedPassword = await bcryptjs.hash(new_password, salt);

            user.password = hashedPassword;
            await user.save();

            res.status(200).send({ message: "Password updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    forgotPassword: async (req: Request, res: Response) => {
        try {
            const { password, email } = req.body;
            const user = await User.findOne({ email: email });
            if (!user) {
                res.status(404).send({ message: "User Not Found" });
                return;
            }

            const salt = await bcryptjs.genSalt(10);
            const hashedPassword = await bcryptjs.hash(password, salt);

            user.password = hashedPassword;
            await user.save();

            res.status(200).json({ message: "Password Reset Successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
};

