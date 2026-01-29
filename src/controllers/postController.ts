import { Request, Response } from 'express';
import Post from '../models/Post';
import User from '../models/User';
import Notification, { NotificationType } from '../models/Notification';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';
import socketService from '../config/socket';

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (file: Express.Multer.File, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: `post_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed'));
        }
      }
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

// Create a new post
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { content } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Nội dung bài viết không được để trống' });
      return;
    }

    if (content.length > 5000) {
      res.status(400).json({ message: 'Nội dung bài viết không được quá 5000 ký tự' });
      return;
    }

    // Upload images to Cloudinary if any
    let imageUrls: string[] = [];
    
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const uploadPromises = req.files.map((file: Express.Multer.File) =>
        uploadToCloudinary(file, 'halaconnect/posts')
      );
      
      try {
        imageUrls = await Promise.all(uploadPromises);
      } catch (uploadError) {
        console.error('Error uploading images:', uploadError);
        res.status(500).json({ message: 'Lỗi khi upload ảnh' });
        return;
      }
    }

    // Create the post
    const post = new Post({
      author: userId,
      content: content.trim(),
      images: imageUrls,
      likes: [],
      likesCount: 0,
      commentsCount: 0,
    });

    await post.save();

    // Populate author info
    await post.populate('author', 'name avatar');

    res.status(201).json({
      message: 'Đăng bài viết thành công',
      post,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Get all posts (with pagination)
export const getPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isPublished: true })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ isPublished: true });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Get a single post by ID
export const getPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate('author', 'name avatar');

    if (!post) {
      res.status(404).json({ message: 'Không tìm thấy bài viết' });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Get posts by user ID
export const getPostsByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ author: userId, isPublished: true })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ author: userId, isPublished: true });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Update a post
export const updatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const { content } = req.body;

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: 'Không tìm thấy bài viết' });
      return;
    }

    // Check if user is the author
    if (post.author.toString() !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa bài viết này' });
      return;
    }

    if (content) {
      post.content = content.trim();
    }

    await post.save();
    await post.populate('author', 'name avatar');

    res.json({
      message: 'Cập nhật bài viết thành công',
      post,
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Delete a post
export const deletePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: 'Không tìm thấy bài viết' });
      return;
    }

    // Check if user is the author
    if (post.author.toString() !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền xóa bài viết này' });
      return;
    }

    await Post.findByIdAndDelete(id);

    res.json({ message: 'Xóa bài viết thành công' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Like a post
export const likePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: 'Không tìm thấy bài viết' });
      return;
    }

    const likeIndex = post.likes.findIndex(
      (like) => like.toString() === userId
    );

    let isLiked = false;

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      // Like
      post.likes.push(userId);
      post.likesCount += 1;
      isLiked = true;

      // Send notification to post author (if not liking own post)
      if (post.author.toString() !== userId) {
        const sender = await User.findById(userId).select('name avatar');
        
        if (sender) {
          // Create notification
          const notification = new Notification({
            recipient: post.author,
            sender: userId,
            type: NotificationType.LIKE_POST,
            relatedObject: post._id,
            relatedObjectModel: 'Post',
            message: `${sender.name} đã thích bài viết của bạn`,
          });
          await notification.save();

          // Populate sender info for socket emission
          await notification.populate('sender', 'name email avatar');

          // Emit realtime notification
          socketService.emitToUser(post.author.toString(), 'notification', {
            type: NotificationType.LIKE_POST,
            notification: notification,
          });
        }
      }
    }

    await post.save();

    res.json({
      message: likeIndex > -1 ? 'Đã bỏ thích' : 'Đã thích bài viết',
      liked: isLiked,
      likesCount: post.likesCount,
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
