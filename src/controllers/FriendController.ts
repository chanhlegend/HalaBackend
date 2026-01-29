import { Request, Response } from 'express';
import Friend from '../models/Friend';
import FriendRequest, { FriendRequestStatus } from '../models/FriendRequest';
import User from '../models/User';
import Notification, { NotificationType } from '../models/Notification';
import Conversation from '../models/Conversation';
import socketService from '../config/socket';

export const getFriendsList = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const friends = await Friend.find({ user: userId }).populate('friend', 'name email avatar');
        res.json(friends);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching friends list', error });
    }
};

export const getFriendRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const requests = await FriendRequest.find({
            receiver: userId,
            status: FriendRequestStatus.PENDING
        }).populate('sender', 'name email avatar');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching friend requests', error });
    }
};

export const getSentFriendRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const requests = await FriendRequest.find({
            sender: userId,
            status: FriendRequestStatus.PENDING
        }).populate('receiver', 'name email avatar');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sent friend requests', error });
    }
};

export const sendFriendRequest = async (req: Request, res: Response) => {
    try {
        const senderId = (req as any).user.userId;
        const { receiverId } = req.body;

        if (senderId === receiverId) {
            return res.status(400).json({ message: 'Cannot send friend request to yourself' });
        }

        const existingRequest = await FriendRequest.findOne({
            sender: senderId,
            receiver: receiverId,
            status: FriendRequestStatus.PENDING,
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Friend request already sent' });
        }

        const existingFriendship = await Friend.findOne({ user: senderId, friend: receiverId });
        if (existingFriendship) {
            return res.status(400).json({ message: 'Users are already friends' });
        }

        const newRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId,
        });

        await newRequest.save();

        // Get sender info for notification
        const sender = await User.findById(senderId).select('name email avatar');

        // Create notification
        const notification = new Notification({
            recipient: receiverId,
            sender: senderId,
            type: NotificationType.FRIEND_REQUEST,
            relatedObject: newRequest._id,
            relatedObjectModel: 'FriendRequest',
            message: `${sender?.name} đã gửi lời mời kết bạn`,
        });

        await notification.save();

        // Populate notification for realtime
        await notification.populate('sender', 'name email avatar');

        // Send realtime notification
        socketService.emitToUser(receiverId.toString(), 'notification', {
            type: 'friend_request',
            notification: notification,
        });

        res.status(201).json({ message: 'Friend request sent', request: newRequest });
    } catch (error) {
        res.status(500).json({ message: 'Error sending friend request', error });
    }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { requestId } = req.body;

        const request = await FriendRequest.findOne({ _id: requestId, receiver: userId });

        if (!request) {
            return res.status(404).json({ message: 'Friend request not found or not for you' });
        }

        if (request.status !== FriendRequestStatus.PENDING) {
            return res.status(400).json({ message: 'Friend request is not pending' });
        }

        request.status = FriendRequestStatus.ACCEPTED;
        await request.save();

        // Create Friend entries for both users
        const friend1 = new Friend({ user: request.sender, friend: request.receiver });
        const friend2 = new Friend({ user: request.receiver, friend: request.sender });

        await Promise.all([friend1.save(), friend2.save()]);

        // Create conversation between the two users
        const existingConversation = await Conversation.findOne({
            participants: { $all: [request.sender, request.receiver] }
        });

        if (!existingConversation) {
            const conversation = new Conversation({
                participants: [request.sender, request.receiver],
            });
            await conversation.save();
        }

        // Get accepter info for notification
        const accepter = await User.findById(userId).select('name email avatar');

        // Create notification for the original sender
        const notification = new Notification({
            recipient: request.sender,
            sender: userId,
            type: NotificationType.FRIEND_REQUEST_ACCEPTED,
            relatedObject: request._id,
            relatedObjectModel: 'FriendRequest',
            message: `${accepter?.name} đã chấp nhận lời mời kết bạn`,
        });

        await notification.save();

        // Populate notification for realtime
        await notification.populate('sender', 'name email avatar');

        // Send realtime notification
        socketService.emitToUser(request.sender.toString(), 'notification', {
            type: 'friend_request_accepted',
            notification: notification,
        });

        res.json({ message: 'Friend request accepted' });
    } catch (error) {
        res.status(500).json({ message: 'Error accepting friend request', error });
    }
};

export const rejectFriendRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { requestId } = req.body;

        const request = await FriendRequest.findOne({ _id: requestId, receiver: userId });

        if (!request) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        if (request.status !== FriendRequestStatus.PENDING) {
            return res.status(400).json({ message: 'Friend request is not pending' });
        }

        request.status = FriendRequestStatus.REJECTED;
        await request.save();

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting friend request', error });
    }
};

export const unfriend = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { friendId } = req.params;

        // Delete friendship entries
        await Friend.findOneAndDelete({ user: userId, friend: friendId });
        await Friend.findOneAndDelete({ user: friendId, friend: userId });

        // Delete friend requests between these users (both directions)
        await FriendRequest.deleteMany({
            $or: [
                { sender: userId, receiver: friendId },
                { sender: friendId, receiver: userId }
            ]
        });

        res.json({ message: 'Unfriended successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error unfriending', error });
    }
}

export const getSuggestions = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        // Get all friends to exclude them
        const friends = await Friend.find({ user: userId }).select('friend');
        const friendIds = friends.map(f => f.friend);

        // Also exclude pending requests (optional, but good UX)
        const pendingSent = await FriendRequest.find({ sender: userId }).select('receiver');
        const pendingReceived = await FriendRequest.find({ receiver: userId }).select('sender');

        const excludeIds = [
            userId,
            ...friendIds,
            ...pendingSent.map(r => r.receiver),
            ...pendingReceived.map(r => r.sender)
        ];

        // Find users not in the exclude list (Limit to 10 for now)
        const suggestions = await User.find({ _id: { $nin: excludeIds } })
            .select('name email avatar')
            .limit(10);

        res.json(suggestions);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching suggestions', error });
    }
}

export const searchUserByEmail = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email }).select('name email avatar');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user._id.toString() === userId) {
            return res.status(400).json({ message: 'Cannot search for yourself' });
        }

        // Check friendship status
        const isFriend = await Friend.findOne({ user: userId, friend: user._id });
        const sentRequest = await FriendRequest.findOne({ sender: userId, receiver: user._id, status: FriendRequestStatus.PENDING });
        const receivedRequest = await FriendRequest.findOne({ sender: user._id, receiver: userId, status: FriendRequestStatus.PENDING });

        let status = 'none';
        if (isFriend) status = 'friend';
        else if (sentRequest) status = 'sent';
        else if (receivedRequest) status = 'received';

        res.json({ user, status });
    } catch (error) {
        res.status(500).json({ message: 'Error searching user', error });
    }
};

// Get friendship status with a specific user
export const getFriendshipStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { targetUserId } = req.params;

        if (userId === targetUserId) {
            return res.json({ status: 'self' });
        }

        // Check friendship status
        const isFriend = await Friend.findOne({ user: userId, friend: targetUserId });
        const sentRequest = await FriendRequest.findOne({ sender: userId, receiver: targetUserId, status: FriendRequestStatus.PENDING });
        const receivedRequest = await FriendRequest.findOne({ sender: targetUserId, receiver: userId, status: FriendRequestStatus.PENDING });

        let status = 'none';
        let requestId = null;
        if (isFriend) {
            status = 'friend';
        } else if (sentRequest) {
            status = 'sent';
            requestId = sentRequest._id;
        } else if (receivedRequest) {
            status = 'received';
            requestId = receivedRequest._id;
        }

        res.json({ status, requestId });
    } catch (error) {
        res.status(500).json({ message: 'Error getting friendship status', error });
    }
};

// Cancel a sent friend request
export const cancelFriendRequest = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { requestId } = req.params;

        const request = await FriendRequest.findOne({ _id: requestId, sender: userId, status: FriendRequestStatus.PENDING });

        if (!request) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        await FriendRequest.deleteOne({ _id: requestId });

        res.json({ message: 'Friend request cancelled' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling friend request', error });
    }
};
