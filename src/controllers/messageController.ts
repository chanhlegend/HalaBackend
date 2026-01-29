import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Message, { MessageType } from '../models/Message';
import User from '../models/User';
import socketService from '../config/socket';

/**
 * Get all conversations for the current user
 * GET /api/messages/conversations
 */
export const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', 'name email avatar')
            .sort({ updatedAt: -1 });

        // Format conversations to include the other participant info and unread count
        const formattedConversations = await Promise.all(conversations.map(async (conv) => {
            const otherParticipant = conv.participants.find(
                (p: any) => p._id.toString() !== userId
            );

            // Count unread messages in this conversation
            const unreadCount = await Message.countDocuments({
                conversation: conv._id,
                sender: { $ne: userId },
                isRead: false,
                isDeleted: false
            });

            return {
                _id: conv._id,
                participant: otherParticipant,
                lastMessage: conv.lastMessage,
                lastMessageTime: conv.lastMessageTime,
                updatedAt: conv.updatedAt,
                unreadCount,
            };
        }));

        res.json(formattedConversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Error fetching conversations', error });
    }
};

/**
 * Get messages for a specific conversation
 * GET /api/messages/:conversationId
 */
export const getMessages = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Verify user is part of conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const messages = await Message.find({
            conversation: conversationId,
            isDeleted: false
        })
            .populate('sender', 'name email avatar')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        // Mark messages as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages', error });
    }
};

/**
 * Send a message
 * POST /api/messages/send
 */
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { conversationId, content, type = MessageType.TEXT, mediaUrl } = req.body;

        if (!conversationId || !content) {
            return res.status(400).json({ message: 'Conversation ID and content are required' });
        }

        // Verify user is part of conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Create message
        const message = new Message({
            conversation: conversationId,
            sender: userId,
            type,
            content,
            mediaUrl,
        });

        await message.save();

        // Update conversation's last message
        conversation.lastMessage = content;
        conversation.lastMessageTime = new Date();
        await conversation.save();

        // Populate sender info
        await message.populate('sender', 'name email avatar');

        // Get other participant to send realtime message
        const otherParticipant = conversation.participants.find(
            (p: any) => p.toString() !== userId
        );

        if (otherParticipant) {
            socketService.emitToUser(otherParticipant.toString(), 'new_message', {
                message,
                conversationId,
            });
        }

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message', error });
    }
};

/**
 * Get or create conversation with a user
 * POST /api/messages/conversation
 */
export const getOrCreateConversation = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { participantId } = req.body;

        if (!participantId) {
            return res.status(400).json({ message: 'Participant ID is required' });
        }

        if (userId === participantId) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' });
        }

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId] }
        }).populate('participants', 'name email avatar');

        if (!conversation) {
            // Create new conversation
            conversation = new Conversation({
                participants: [userId, participantId]
            });
            await conversation.save();
            await conversation.populate('participants', 'name email avatar');
        }

        const otherParticipant = conversation.participants.find(
            (p: any) => p._id.toString() !== userId
        );

        res.json({
            _id: conversation._id,
            participant: otherParticipant,
            lastMessage: conversation.lastMessage,
            lastMessageTime: conversation.lastMessageTime,
        });
    } catch (error) {
        console.error('Error getting/creating conversation:', error);
        res.status(500).json({ message: 'Error getting/creating conversation', error });
    }
};

/**
 * Mark messages as read
 * PUT /api/messages/:conversationId/read
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { conversationId } = req.params;

        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Notify sender that messages were read
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
            const otherParticipant = conversation.participants.find(
                (p: any) => p.toString() !== userId
            );
            if (otherParticipant) {
                socketService.emitToUser(otherParticipant.toString(), 'messages_read', {
                    conversationId,
                    readBy: userId
                });
            }
        }

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Error marking messages as read', error });
    }
};

/**
 * Delete a message (soft delete)
 * DELETE /api/messages/:messageId
 */
export const deleteMessage = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { messageId } = req.params;

        const message = await Message.findOne({
            _id: messageId,
            sender: userId
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found or not authorized' });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Error deleting message', error });
    }
};

/**
 * Get unread message count
 * GET /api/messages/unread-count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        // Get all conversations user is part of
        const conversations = await Conversation.find({
            participants: userId
        });

        const conversationIds = conversations.map(c => c._id);

        const unreadCount = await Message.countDocuments({
            conversation: { $in: conversationIds },
            sender: { $ne: userId },
            isRead: false,
            isDeleted: false
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Error getting unread count', error });
    }
};
