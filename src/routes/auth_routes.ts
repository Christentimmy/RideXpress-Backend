import express from 'express';
import { authController } from '../controllers/auth_controller';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOTp);
router.post('/verify-otp', authController.verifyOTP);






export default router;





