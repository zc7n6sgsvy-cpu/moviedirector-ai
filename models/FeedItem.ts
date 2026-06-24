import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeedItem extends Document {
  projectId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  creatorUsername: string;
  title: string;
  logline: string;
  publishedAt: Date;
}

const FeedItemSchema: Schema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  creatorUsername: { type: String, required: true },
  title: { type: String, required: true },
  logline: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
});

const FeedItem: Model<IFeedItem> = mongoose.models.FeedItem || mongoose.model<IFeedItem>('FeedItem', FeedItemSchema);

export default FeedItem;
