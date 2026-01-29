import { Request, Response } from 'express';
import Comment from '../models/Comment';
import Post from '../models/Post';
import User from '../models/User';
import Notification, { NotificationType } from '../models/Notification';
import socketService from '../config/socket';

// Create a new comment
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ message: 'Nội dung bình luận không được quá 2000 ký tự' });
      return;
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ message: 'Không tìm thấy bài viết' });
      return;
    }

    // Create the comment
    const comment = new Comment({
      post: postId,
      author: userId,
      content: content.trim(),
      likes: [],
      likesCount: 0,
      replies: [],
      parentComment: parentCommentId || null,
    });

    await comment.save();

    // If this is a reply, add to parent comment's replies array
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id },
      });

      // Send notification to parent comment author
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && parentComment.author.toString() !== userId) {
        const sender = await User.findById(userId).select('name avatar');
        
        if (sender) {
          const notification = new Notification({
            recipient: parentComment.author,
            sender: userId,
            type: NotificationType.REPLY_COMMENT,
            relatedObject: comment._id,
            relatedObjectModel: 'Comment',
            message: `${sender.name} đã trả lời bình luận của bạn`,
          });
          await notification.save();
          await notification.populate('sender', 'name email avatar');

          socketService.emitToUser(parentComment.author.toString(), 'notification', {
            type: NotificationType.REPLY_COMMENT,
            notification: notification,
          });
        }
      }
    } else {
      // Send notification to post author (if not commenting on own post)
      if (post.author.toString() !== userId) {
        const sender = await User.findById(userId).select('name avatar');
        
        if (sender) {
          const notification = new Notification({
            recipient: post.author,
            sender: userId,
            type: NotificationType.COMMENT,
            relatedObject: comment._id,
            relatedObjectModel: 'Comment',
            message: `${sender.name} đã bình luận bài viết của bạn`,
          });
          await notification.save();
          await notification.populate('sender', 'name email avatar');

          socketService.emitToUser(post.author.toString(), 'notification', {
            type: NotificationType.COMMENT,
            notification: notification,
          });
        }
      }
    }

    // Update post's comment count
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 },
    });

    // Populate author info
    await comment.populate('author', 'name avatar');

    res.status(201).json({
      message: 'Bình luận thành công',
      comment,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Get comments for a post
export const getCommentsByPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get only root comments (no parentComment)
    const comments = await Comment.find({ post: postId, parentComment: null })
      .populate('author', 'name avatar')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'name avatar',
        },
        options: { limit: 3, sort: { createdAt: 1 } },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ post: postId, parentComment: null });

    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Get replies for a comment
export const getReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const replies = await Comment.find({ parentComment: commentId })
      .populate('author', 'name avatar')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ parentComment: commentId });

    res.json({
      replies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Update a comment
export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: 'Không tìm thấy bình luận' });
      return;
    }

    // Check if user is the author
    if (comment.author.toString() !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa bình luận này' });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      return;
    }

    comment.content = content.trim();
    await comment.save();
    await comment.populate('author', 'name avatar');

    res.json({
      message: 'Cập nhật bình luận thành công',
      comment,
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: 'Không tìm thấy bình luận' });
      return;
    }

    // Check if user is the author
    if (comment.author.toString() !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
      return;
    }

    // Count total comments to delete (including replies)
    const repliesCount = await Comment.countDocuments({ parentComment: commentId });
    const totalToDelete = 1 + repliesCount;

    // Delete all replies first
    await Comment.deleteMany({ parentComment: commentId });

    // If this is a reply, remove from parent's replies array
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: commentId },
      });
    }

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    // Update post's comment count
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -totalToDelete },
    });

    res.json({ message: 'Xóa bình luận thành công' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Like a comment
export const likeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: 'Không tìm thấy bình luận' });
      return;
    }

    const likeIndex = comment.likes.findIndex(
      (like) => like.toString() === userId
    );

    let isLiked = false;

    if (likeIndex > -1) {
      // Unlike
      comment.likes.splice(likeIndex, 1);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
    } else {
      // Like
      comment.likes.push(userId);
      comment.likesCount += 1;
      isLiked = true;

      // Send notification to comment author (if not liking own comment)
      if (comment.author.toString() !== userId) {
        const sender = await User.findById(userId).select('name avatar');
        
        if (sender) {
          const notification = new Notification({
            recipient: comment.author,
            sender: userId,
            type: NotificationType.LIKE_COMMENT,
            relatedObject: comment._id,
            relatedObjectModel: 'Comment',
            message: `${sender.name} đã thích bình luận của bạn`,
          });
          await notification.save();
          await notification.populate('sender', 'name email avatar');

          socketService.emitToUser(comment.author.toString(), 'notification', {
            type: NotificationType.LIKE_COMMENT,
            notification: notification,
          });
        }
      }
    }

    await comment.save();

    res.json({
      message: likeIndex > -1 ? 'Đã bỏ thích' : 'Đã thích bình luận',
      liked: isLiked,
      likesCount: comment.likesCount,
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
