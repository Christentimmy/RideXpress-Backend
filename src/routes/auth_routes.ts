import express from "express";
import { authController } from "../controllers/auth_controller";
import tokenValidationMiddleware from "../middlewares/token_validator";

const router = express.Router();

router.post("/google-auth-signup", authController.googleAuthSignUp);
router.post("/google-auth-signin", authController.googleAuthSignIn);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/send-otp", authController.sendOTp);
router.post("/verify-otp", authController.verifyOTP);
router.post("/driver-register", authController.driverRegister);
router.post("/forgot-password", authController.forgotPassword);
router.post("/update-email-or-number", authController.updateEmailOrNumber);

router.use(tokenValidationMiddleware);
router.post("/logout", authController.logoutUser);
router.post("/change-password", authController.changePassword);

export default router;
