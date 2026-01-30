import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User, { IUser } from '../models/User';
import { sendOTPEmail, generateOTP } from '../utils/emailService';

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Register a new user
 * POST /auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
            return;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(400).json({ error: 'Email đã được sử dụng' });
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create user
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            emailVerificationOTP: otp,
            emailVerificationOTPExpires: otpExpires,
            isEmailVerified: false,
        });

        await user.save();

        // Send OTP email
        try {
            await sendOTPEmail(email, otp, name);
        } catch (emailError) {
            console.error('Error sending OTP email:', emailError);
            // Don't fail registration if email fails
        }

        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
            email: user.email,
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng ký' });
    }
};

/**
 * Verify OTP
 * POST /auth/verify-otp
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({ error: 'Vui lòng cung cấp email và mã OTP' });
            return;
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(404).json({ error: 'Không tìm thấy người dùng' });
            return;
        }

        // Check if already verified
        if (user.isEmailVerified) {
            res.status(400).json({ error: 'Email đã được xác thực' });
            return;
        }

        // Check OTP
        if (user.emailVerificationOTP !== otp) {
            res.status(400).json({ error: 'Mã OTP không chính xác' });
            return;
        }

        // Check OTP expiration
        if (!user.emailVerificationOTPExpires || user.emailVerificationOTPExpires < new Date()) {
            res.status(400).json({ error: 'Mã OTP đã hết hạn' });
            return;
        }

        // Verify user
        user.isEmailVerified = true;
        user.emailVerificationOTP = undefined;
        user.emailVerificationOTPExpires = undefined;
        await user.save();

        res.json({ message: 'Xác thực email thành công!' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực OTP' });
    }
};

/**
 * Resend OTP
 * POST /auth/resend-otp
 */
export const resendOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Vui lòng cung cấp email' });
            return;
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(404).json({ error: 'Không tìm thấy người dùng' });
            return;
        }

        // Check if already verified
        if (user.isEmailVerified) {
            res.status(400).json({ error: 'Email đã được xác thực' });
            return;
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.emailVerificationOTP = otp;
        user.emailVerificationOTPExpires = otpExpires;
        await user.save();

        // Send OTP email
        await sendOTPEmail(email, otp, user.name);

        res.json({ message: 'Mã OTP mới đã được gửi đến email của bạn' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi gửi lại mã OTP' });
    }
};

/**
 * Login
 * POST /auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
            return;
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
            return;
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            res.status(403).json({ error: 'Vui lòng xác thực email trước khi đăng nhập' });
            return;
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
            return;
        }

        // Generate tokens
        const jwtSecret = (process.env.JWT_SECRET || 'your_jwt_secret_key_here') as jwt.Secret;
        const jwtExpire = (process.env.JWT_EXPIRE || '7d') as string;

        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            jwtSecret,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            jwtSecret,
            { expiresIn: jwtExpire as any }
        );

        // Save refresh token
        user.refreshTokens.push(refreshToken);
        user.lastLogin = new Date();
        await user.save();

        res.json({
            message: 'Đăng nhập thành công',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng nhập' });
    }
};

/**
 * Refresh token
 * POST /auth/refresh-token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Vui lòng cung cấp refresh token' });
            return;
        }

        // Verify refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch (error) {
            res.status(401).json({ error: 'Refresh token không hợp lệ' });
            return;
        }

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            res.status(404).json({ error: 'Không tìm thấy người dùng' });
            return;
        }

        // Check if refresh token exists in user's tokens
        if (!user.refreshTokens.includes(refreshToken)) {
            res.status(401).json({ error: 'Refresh token không hợp lệ' });
            return;
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your_jwt_secret_key_here',
            { expiresIn: '1h' }
        );

        res.json({
            accessToken: newAccessToken,
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi làm mới token' });
    }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Vui lòng cung cấp refresh token' });
            return;
        }

        // Verify refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch (error) {
            res.status(401).json({ error: 'Refresh token không hợp lệ' });
            return;
        }

        // Find user and remove refresh token
        const user = await User.findById(decoded.userId);
        if (user) {
            user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
            await user.save();
        }

        res.json({ message: 'Đăng xuất thành công' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng xuất' });
    }
};

/**
 * Forgot password - Send OTP
 * POST /auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Vui lòng cung cấp email' });
            return;
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
            return;
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.resetPasswordToken = otp;
        user.resetPasswordExpires = otpExpires;
        await user.save();

        // Send OTP email
        await sendOTPEmail(email, otp, user.name);

        res.json({ message: 'Mã xác thực đã được gửi đến email của bạn' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi gửi mã xác thực' });
    }
};

/**
 * Verify Reset Password OTP
 * POST /auth/verify-reset-otp
 */
export const verifyResetOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({ error: 'Vui lòng cung cấp email và mã OTP' });
            return;
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: otp,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            res.status(400).json({ error: 'Mã OTP không chính xác hoặc đã hết hạn' });
            return;
        }

        res.json({ message: 'Mã OTP hợp lệ' });
    } catch (error) {
        console.error('Verify reset OTP error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực mã OTP' });
    }
};

/**
 * Reset Password
 * POST /auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
            return;
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: otp,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            res.status(400).json({ error: 'Mã OTP không chính xác hoặc đã hết hạn' });
            return;
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Clear reset token
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đặt lại mật khẩu' });
    }
};

/**
 * Google Login
 * POST /auth/google
 */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { credential } = req.body;

        if (!credential) {
            res.status(400).json({ error: 'Vui lòng cung cấp Google credential' });
            return;
        }

        // Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            res.status(400).json({ error: 'Không thể xác thực tài khoản Google' });
            return;
        }

        const { email, name, picture, sub: googleId } = payload;

        if (!email) {
            res.status(400).json({ error: 'Không thể lấy email từ tài khoản Google' });
            return;
        }

        // Check if user exists
        let user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            // Update Google ID if not set
            if (!user.googleId) {
                user.googleId = googleId;
            }
            // Update avatar if not set
            if (!user.avatar && picture) {
                user.avatar = picture;
            }
        } else {
            // Create new user
            user = new User({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                googleId,
                avatar: picture,
                isEmailVerified: true, // Google accounts are already verified
                password: '', // No password for Google accounts
            });
        }

        // Generate tokens
        const jwtSecret = (process.env.JWT_SECRET || 'your_jwt_secret_key_here') as jwt.Secret;
        const jwtExpire = (process.env.JWT_EXPIRE || '7d') as string;

        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            jwtSecret,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            jwtSecret,
            { expiresIn: jwtExpire as any }
        );

        // Save refresh token
        user.refreshTokens.push(refreshToken);
        user.lastLogin = new Date();
        await user.save();

        res.json({
            message: 'Đăng nhập Google thành công',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
            },
        });
    } catch (error: any) {
        console.error('Google login error:', error);
        if (error.message?.includes('Token used too late') || error.message?.includes('Token used too early')) {
            res.status(400).json({ error: 'Token Google đã hết hạn, vui lòng thử lại' });
            return;
        }
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng nhập bằng Google' });
    }
};
