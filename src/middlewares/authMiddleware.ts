import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

/**
 * Middleware to verify JWT token
 */
export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Không có token xác thực' });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your_jwt_secret_key_here'
            ) as { userId: string; email: string };

            // Attach user to request
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
            return;
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực' });
    }
};
