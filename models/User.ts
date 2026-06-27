import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, index: true },
  displayName: { type: String, trim: true },
  bio: { type: String, maxlength: 300 },
  avatarUrl: { type: String },
  email: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
