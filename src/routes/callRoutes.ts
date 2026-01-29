import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
    generateToken,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall
} from '../controllers/callController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/token', generateToken);
router.post('/initiate', initiateCall);
router.post('/accept', acceptCall);
router.post('/reject', rejectCall);
router.post('/end', endCall);

export default router;
