import { Router } from 'express';
import {
    register,
    verifyOTP,
    resendOTP,
    login,
    refreshToken,
    logout,
} from '../controllers/authController';

const router = Router();

// Authentication routes
router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

export default router;
