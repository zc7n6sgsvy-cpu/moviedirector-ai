import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeedItem extends Document {
  projectId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  creatorUsername: string;
  title: string;
  logline: string;
  likeCount: number;
  commentCount: number;
  ratingAvg: number;
  ratingCount: number;
  publishedAt: Date;
}

const FeedItemSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  creatorUsername: { type: String, required: true },
  title: { type: String, required: true },
  logline: { type: String, required: true },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  publishedAt: { type: Date, default: Date.now },
});

FeedItemSchema.index({ publishedAt: -1 });
FeedItemSchema.index({ projectId: 1 }, { unique: true });

const FeedItem: Model<IFeedItem> = mongoose.models.FeedItem || mongoose.model<IFeedItem>('FeedItem', FeedItemSchema);

export default FeedItem;
