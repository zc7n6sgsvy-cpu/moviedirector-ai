import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChannelSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ChannelSubscriptionSchema = new Schema<IChannelSubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
  createdAt: { type: Date, default: Date.now },
});

ChannelSubscriptionSchema.index({ userId: 1, channelId: 1 }, { unique: true });
ChannelSubscriptionSchema.index({ channelId: 1 });

const ChannelSubscription: Model<IChannelSubscription> =
  mongoose.models.ChannelSubscription ||
  mongoose.model<IChannelSubscription>('ChannelSubscription', ChannelSubscriptionSchema);

export default ChannelSubscription;