import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
    getConversations,
    getMessages,
    sendMessage,
    getOrCreateConversation,
    markAsRead,
    deleteMessage,
    getUnreadCount
} from '../controllers/messageController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Conversation routes
router.get('/conversations', getConversations);
router.post('/conversation', getOrCreateConversation);

// Message routes
router.get('/unread-count', getUnreadCount);
router.get('/:conversationId', getMessages);
router.post('/send', sendMessage);
router.put('/:conversationId/read', markAsRead);
router.delete('/:messageId', deleteMessage);

export default router;
