import { Request, Response } from 'express';
import Notification from '../models/Notification';

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { limit = 20, skip = 0 } = req.query;

        const notifications = await Notification.find({ recipient: userId })
            .populate('sender', 'name email avatar')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(Number(skip));

        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });

        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};

export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });

        res.json({ unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count', error });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { notificationId } = req.body;

        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking notification as read', error });
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking all notifications as read', error });
    }
};

export const deleteNotification = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { notificationId } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error });
    }
};

export const deleteAllNotifications = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        await Notification.deleteMany({ recipient: userId });

        res.json({ message: 'All notifications deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting all notifications', error });
    }
};
