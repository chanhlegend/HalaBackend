import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFriend extends Document {
  user: Types.ObjectId;
  friend: Types.ObjectId;
  createdAt: Date;
}

const friendSchema: Schema = new Schema<IFriend>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    friend: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure no duplicate friendships
friendSchema.index({ user: 1, friend: 1 }, { unique: true });

export default mongoose.model<IFriend>('Friend', friendSchema);
