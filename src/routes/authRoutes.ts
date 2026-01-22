import { Router } from 'express';
import {
    register,
    verifyOTP,
    resendOTP,
    login,
    refreshToken,
    logout,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
} from '../controllers/authController';

const router = Router();

// Authentication routes
router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

export default router;
