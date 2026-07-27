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
  /** Lifetime opens — exposure / fairness */
  impressionCount: number;
  /** Watches + rewatches — revolving "still playing" */
  watchCount: number;
  /** Last open — year-old films return when this is recent */
  lastWatchedAt?: Date;
  publishedAt: Date;
  previewClip?: string;
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
  impressionCount: { type: Number, default: 0 },
  watchCount: { type: Number, default: 0 },
  lastWatchedAt: { type: Date },
  publishedAt: { type: Date, default: Date.now },
  previewClip: String,
});

FeedItemSchema.index({ publishedAt: -1 });
FeedItemSchema.index({ projectId: 1 }, { unique: true });
FeedItemSchema.index({ lastWatchedAt: -1 });
FeedItemSchema.index({ watchCount: -1, ratingAvg: -1 });

const FeedItem: Model<IFeedItem> =
  mongoose.models.FeedItem || mongoose.model<IFeedItem>('FeedItem', FeedItemSchema);

export default FeedItem;
