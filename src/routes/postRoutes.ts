import express from 'express';
import { 
  createPost, 
  getPosts, 
  getPostById, 
  getPostsByUser,
  updatePost, 
  deletePost, 
  likePost 
} from '../controllers/postController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

const router = express.Router();

// Get all posts (public with pagination)
router.get('/', getPosts);

// Get a single post by ID
router.get('/:id', getPostById);

// Get posts by user ID
router.get('/user/:userId', getPostsByUser);

// Create a new post (with up to 10 images)
router.post('/', authMiddleware, upload.array('images', 10), createPost);

// Update a post
router.put('/:id', authMiddleware, updatePost);

// Delete a post
router.delete('/:id', authMiddleware, deletePost);

// Like/Unlike a post
router.post('/:id/like', authMiddleware, likePost);

export default router;
