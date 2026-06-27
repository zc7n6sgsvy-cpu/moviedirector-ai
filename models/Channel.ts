import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChannel extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  projectIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<IChannel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, default: 9 },
  projectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
}, { timestamps: true });

const Channel: Model<IChannel> =
  mongoose.models.Channel || mongoose.model<IChannel>('Channel', ChannelSchema);

export default Channel;