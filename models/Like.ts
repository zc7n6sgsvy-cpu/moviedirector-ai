import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  feedItemId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const LikeSchema = new Schema<ILike>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  feedItemId: { type: Schema.Types.ObjectId, ref: 'FeedItem', required: true },
  createdAt: { type: Date, default: Date.now },
});

LikeSchema.index({ userId: 1, feedItemId: 1 }, { unique: true });
LikeSchema.index({ feedItemId: 1 });

const Like: Model<ILike> = mongoose.models.Like || mongoose.model<ILike>('Like', LikeSchema);

export default Like;