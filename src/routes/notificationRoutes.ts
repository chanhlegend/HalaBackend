import { Router } from 'express';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
} from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/mark-read', markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.delete('/:notificationId', deleteNotification);
router.delete('/', deleteAllNotifications);

export default router;
