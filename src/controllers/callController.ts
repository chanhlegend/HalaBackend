import { Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import socketService from '../config/socket';

const APP_ID = process.env.AGORA_APP_ID || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || ''; // Optional for testing mode

/**
 * Generate Agora token for video call
 * POST /api/calls/token
 */
export const generateToken = async (req: Request, res: Response) => {
    try {
        const { channelName } = req.body;
        const userId = (req as any).user.userId;

        if (!channelName) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        if (!APP_ID) {
            return res.status(500).json({ message: 'Agora App ID not configured' });
        }

        // If no certificate, return null token (testing mode - no authentication)
        if (!APP_CERTIFICATE) {
            return res.json({
                token: null, // No token needed in testing mode
                appId: APP_ID,
                channelName,
                uid: 0,
            });
        }

        const uid = 0; // Use 0 for dynamic UID assignment
        const role = RtcRole.PUBLISHER;
        const expireTime = 3600; // Token expires in 1 hour
        const currentTime = Math.floor(Date.now() / 1000);
        const privilegeExpireTime = currentTime + expireTime;

        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uid,
            role,
            privilegeExpireTime
        );

        res.json({
            token,
            appId: APP_ID,
            channelName,
            uid,
        });
    } catch (error) {
        console.error('Error generating Agora token:', error);
        res.status(500).json({ message: 'Error generating token', error });
    }
};

/**
 * Initiate a call
 * POST /api/calls/initiate
 */
export const initiateCall = async (req: Request, res: Response) => {
    try {
        const callerId = (req as any).user.userId;
        const { receiverId, callerName, callerAvatar, callType = 'video' } = req.body;

        if (!receiverId) {
            return res.status(400).json({ message: 'Receiver ID is required' });
        }

        if (!APP_ID) {
            return res.status(500).json({ message: 'Agora App ID not configured' });
        }

        // Generate unique channel name (must be within 64 bytes)
        const shortCallerId = callerId.slice(-6);
        const shortReceiverId = receiverId.slice(-6);
        const timestamp = Date.now().toString().slice(-8);
        const channelName = `call_${shortCallerId}_${shortReceiverId}_${timestamp}`;

        let token = null;

        // Only generate token if certificate is configured
        if (APP_CERTIFICATE && APP_CERTIFICATE !== 'your_agora_app_certificate') {
            const uid = 0;
            const role = RtcRole.PUBLISHER;
            const expireTime = 3600;
            const currentTime = Math.floor(Date.now() / 1000);
            const privilegeExpireTime = currentTime + expireTime;

            token = RtcTokenBuilder.buildTokenWithUid(
                APP_ID,
                APP_CERTIFICATE,
                channelName,
                uid,
                role,
                privilegeExpireTime
            );
        }

        // Send call notification to receiver via socket
        socketService.emitToUser(receiverId, 'incoming_call', {
            callerId,
            callerName,
            callerAvatar,
            channelName,
            token,
            appId: APP_ID,
            callType,
        });

        res.json({
            channelName,
            token,
            appId: APP_ID,
            uid: 0,
        });
    } catch (error) {
        console.error('Error initiating call:', error);
        res.status(500).json({ message: 'Error initiating call', error });
    }
};

/**
 * Accept a call
 * POST /api/calls/accept
 */
export const acceptCall = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { callerId, channelName, userName, userAvatar } = req.body;

        // Notify caller that call was accepted
        socketService.emitToUser(callerId, 'call_accepted', {
            oderId: userId,
            userName,
            userAvatar,
            channelName,
        });

        res.json({ message: 'Call accepted' });
    } catch (error) {
        console.error('Error accepting call:', error);
        res.status(500).json({ message: 'Error accepting call', error });
    }
};

/**
 * Reject a call
 * POST /api/calls/reject
 */
export const rejectCall = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { callerId, reason = 'rejected' } = req.body;

        // Notify caller that call was rejected
        socketService.emitToUser(callerId, 'call_rejected', {
            userId,
            reason,
        });

        res.json({ message: 'Call rejected' });
    } catch (error) {
        console.error('Error rejecting call:', error);
        res.status(500).json({ message: 'Error rejecting call', error });
    }
};

/**
 * End a call
 * POST /api/calls/end
 */
export const endCall = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { otherId } = req.body;

        // Notify the other party that call ended
        socketService.emitToUser(otherId, 'call_ended', {
            oderId: userId,
        });

        res.json({ message: 'Call ended' });
    } catch (error) {
        console.error('Error ending call:', error);
        res.status(500).json({ message: 'Error ending call', error });
    }
};
