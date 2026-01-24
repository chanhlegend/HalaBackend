import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  coverPhoto?: string;
  bio?: string;
  dateOfBirth?: Date;
  workplace?: string;
  location?: string;
  isEmailVerified: boolean;
  emailVerificationOTP?: string;
  emailVerificationOTPExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshTokens: string[];
  googleId?: string;
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    coverPhoto: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    dateOfBirth: {
      type: Date,
    },
    workplace: {
      type: String,
      maxlength: 100,
    },
    location: {
      type: String,
      maxlength: 100,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOTP: {
      type: String,
    },
    emailVerificationOTPExpires: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    refreshTokens: [
      {
        type: String,
      },
    ],
    googleId: {
      type: String,
      sparse: true,
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', userSchema);
