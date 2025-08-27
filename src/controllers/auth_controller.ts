import { Request, Response } from "express";
import User from "../models/user_model";
import generateToken from "../utils/token_generator";
import { sendOTP } from "../services/email_service";
import { redisController } from "./redis_controller";

import bcryptjs from "bcryptjs";
import { verifyGoogleToken } from "../utils/google_token";

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
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(password, salt);

      const user = new User({
        first_name,
        last_name,
        email,
        password: hashedPassword,
      });

      const otp = Math.floor(1000 + Math.random() * 9000)
        .toString()
        .padStart(4, "0");

      const token = generateToken(user);
      await user.save();

      const success = await sendOTP(user.email, otp);
      if (!success) {
        res.status(500).json({ message: "Failed to send OTP" });
        return;
      }

      await redisController.saveOtpToStore(user.email, otp);
      res.status(201).json({ message: "User registered successfully", token });
    } catch (error) {
      console.error(`AuthController:register: ${error}`);
      res.status(500).json({ message: "Server error" });
    }
  },

  driverRegister: async (req: Request, res: Response) => {
    try {
      if (!req.body) {
        res.status(400).json({ message: "Bad request" });
        return;
      }
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

      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(password, salt);

      const user = new User({
        first_name,
        last_name,
        email,
        password: hashedPassword,
        role: "driver",
        driverProfile: {
          city,
          state,
        },
      });

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      console.log(otp);
      // const success = await sendOTP(user.email, otp);
      // if (!success) {
      //   res.status(500).json({ message: "Failed to send OTP" });
      //   return;
      // }
      await redisController.saveOtpToStore(user.email, otp);

      const token = generateToken(user);
      await user.save();
      res.status(201).json({ message: "User registered successfully", token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  googleAuthSignIn: async (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({ message: "Missing request body" });
        return;
      }
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token is required" });

      const googleUser = await verifyGoogleToken(token);

      const user = await User.findOne({ email: googleUser.email });

      if (!user) {
        res.status(404).json({ message: "Invalid Credentials" });
        return;
      }

      const jwtToken = generateToken(user);
      if (!user.isPhoneVerified && !user.isEmailVerified) {
        res.status(402).json({
          message: "Please verify your phone number or email",
          jwtToken,
          email: user.email,
        });
        return;
      }

      if (user.role == "driver") {
        if (!user.driverProfile.isProfileCompleted) {
          res.status(405).json({
            message: "Please complete your driver profile",
            jwtToken,
            driverProfile: user.driverProfile,
          });
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

      if (user.role === "rider" && user.payment_fine > 0) {
        res.status(408).json({ message: "You have a payment fine" });
        return;
      }

      res
        .status(200)
        .json({ message: "User logged in successfully", token: jwtToken });
    } catch (error) {
      console.error("Google login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  googleAuthSignUp: async (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({ message: "Missing request body" });
        return;
      }
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token is required" });

      const googleUser = await verifyGoogleToken(token);

      let exist = await User.findOne({ email: googleUser.email });
      if (exist) {
        res.status(404).json({ message: "User already exists" });
        return;
      }

      if (!googleUser.name) {
        res.status(400).json({ message: "Invalid credentials" });
        return;
      }

      const firstName = googleUser.name?.split(" ")[0] ?? "";
      const lastName = googleUser.name?.split(" ")[1] ?? "";

      const user = new User({
        first_name: firstName,
        last_name: lastName,
        email: googleUser.email,
        avatar: googleUser.picture,
        role: "user",
      });

      const jwtToken = generateToken(user);
      await user.save();

      res
        .status(201)
        .json({
          message: "User registered successfully",
          jwtToken,
          email: googleUser.email,
        });
    } catch (error) {
      console.error("Google signup error:", error);
      res.status(500).json({ message: "Internal server error" });
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
      const isMatch = await bcryptjs.compare(password, user.password);
      if (!isMatch) {
        res.status(400).json({ message: "Invalid credentials" });
        return;
      }
      const token = generateToken(user);
      if (!user.isPhoneVerified && !user.isEmailVerified) {
        res.status(402).json({
          message: "Please verify your phone number or email",
          token,
          email: user.email,
        });
        return;
      }

      if (user.role == "driver") {
        if (!user.driverProfile.isProfileCompleted) {
          res.status(405).json({
            message: "Please complete your driver profile",
            token,
            driverProfile: user.driverProfile,
          });
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

      if (user.role === "rider" && user.payment_fine > 0) {
        res.status(408).json({ message: "You have a payment fine" });
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
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ message: "Email field is required" });
        return;
      }
      const user = await User.findOne({ email });
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

      const user = await User.findOne({ email });
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
        user.isEmailVerified = true;
      }

      if (phone_number) {
        user.phone = phone_number;
        user.isPhoneVerified = true;
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
  },

  updateEmailOrNumber: async (req: Request, res: Response) => {
    try {
      const { email, phone_number } = req.body;
      const user = res.locals.user;
      if (!user) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      if (email) {
        user.email = email;
      }
      if (phone_number) {
        user.phone = phone_number;
      }
      await user.save();
      res.status(200).json({ message: "Email or Number updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
