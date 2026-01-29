import express from 'express';
import {
    getFriendsList,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    unfriend,
    getSuggestions,
    searchUserByEmail,
    getFriendshipStatus,
    cancelFriendRequest
} from '../controllers/FriendController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authMiddleware); // Apply auth middleware to all routes

router.get('/', getFriendsList);
router.get('/requests', getFriendRequests);
router.post('/request', sendFriendRequest);
router.post('/request/accept', acceptFriendRequest);
router.post('/request/reject', rejectFriendRequest);
router.delete('/request/:requestId', cancelFriendRequest);
router.delete('/:friendId', unfriend);
router.get('/suggestions', getSuggestions);
router.post('/search', searchUserByEmail);
router.get('/status/:targetUserId', getFriendshipStatus);

export default router;
