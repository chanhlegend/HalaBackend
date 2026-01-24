import { Router } from 'express';
import {
  getUsers,
  getUserById,
  getProfile,
  updateProfile,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

// Admin routes (add authentication later)
router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
