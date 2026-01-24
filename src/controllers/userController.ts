import { Request, Response } from 'express';
import User from '../models/User';

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
