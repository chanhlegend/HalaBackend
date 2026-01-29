import express from 'express';
import {
  createComment,
  getCommentsByPost,
  getReplies,
  updateComment,
  deleteComment,
  likeComment,
} from '../controllers/commentController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Get comments for a post
router.get('/post/:postId', getCommentsByPost);

// Get replies for a comment
router.get('/:commentId/replies', getReplies);

// Create a new comment on a post
router.post('/post/:postId', authMiddleware, createComment);

// Update a comment
router.put('/:commentId', authMiddleware, updateComment);

// Delete a comment
router.delete('/:commentId', authMiddleware, deleteComment);

// Like/Unlike a comment
router.post('/:commentId/like', authMiddleware, likeComment);

export default router;
