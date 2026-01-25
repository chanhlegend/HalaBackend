import { Request, Response } from 'express';
import User from '../models/User';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';

export const getUsers = (req: Request, res: Response): void => {
  res.json({ message: 'Get all users' });
};

export const getUserById = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `Get user ${id}` });
};

// Get current user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    
    const user = await User.findById(userId).select('-password -refreshTokens -emailVerificationOTP -resetPasswordToken');
    
    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { name, bio, workplace, location, dateOfBirth, phone } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      res.status(400).json({ message: 'Tên không được để trống' });
      return;
    }

    // Prepare update data
    const updateData: any = {
      name: name.trim(),
    };

    if (bio !== undefined) updateData.bio = bio.trim();
    if (workplace !== undefined) updateData.workplace = workplace.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens -emailVerificationOTP -resetPasswordToken');

    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
      return;
    }

    res.json(user);
  } catch (error: any) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const createUser = (req: Request, res: Response): void => {
  res.json({ message: 'User created' });
};

export const updateUser = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `User ${id} updated` });
};

export const deleteUser = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `User ${id} deleted` });
};

// Upload avatar to Cloudinary
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    if (!req.file) {
      res.status(400).json({ message: 'Vui lòng chọn file ảnh' });
      return;
    }

    // Upload to Cloudinary using stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'halaconnect/avatars',
        public_id: `avatar_${userId}_${Date.now()}`,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto' },
        ],
      },
      async (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          res.status(500).json({ message: 'Lỗi khi upload ảnh' });
          return;
        }

        if (!result) {
          res.status(500).json({ message: 'Không thể upload ảnh' });
          return;
        }

        // Update user avatar in database
        const user = await User.findByIdAndUpdate(
          userId,
          { avatar: result.secure_url },
          { new: true }
        ).select('-password -refreshTokens -emailVerificationOTP -resetPasswordToken');

        if (!user) {
          res.status(404).json({ message: 'Không tìm thấy người dùng' });
          return;
        }

        res.json({
          message: 'Cập nhật avatar thành công',
          avatar: result.secure_url,
          user,
        });
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Upload cover photo to Cloudinary
export const uploadCoverPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    if (!req.file) {
      res.status(400).json({ message: 'Vui lòng chọn file ảnh' });
      return;
    }

    // Upload to Cloudinary using stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'halaconnect/covers',
        public_id: `cover_${userId}_${Date.now()}`,
        transformation: [
          { width: 1200, height: 400, crop: 'fill' },
          { quality: 'auto' },
        ],
      },
      async (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          res.status(500).json({ message: 'Lỗi khi upload ảnh' });
          return;
        }

        if (!result) {
          res.status(500).json({ message: 'Không thể upload ảnh' });
          return;
        }

        // Update user cover photo in database
        const user = await User.findByIdAndUpdate(
          userId,
          { coverPhoto: result.secure_url },
          { new: true }
        ).select('-password -refreshTokens -emailVerificationOTP -resetPasswordToken');

        if (!user) {
          res.status(404).json({ message: 'Không tìm thấy người dùng' });
          return;
        }

        res.json({
          message: 'Cập nhật ảnh bìa thành công',
          coverPhoto: result.secure_url,
          user,
        });
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error('Upload cover photo error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
