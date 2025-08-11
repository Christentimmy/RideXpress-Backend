import express from 'express';
import { authController } from '../controllers/auth_controller';

const router = express.Router();

router.post('/register', authController.register);

export default router;





