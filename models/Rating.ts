import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRating extends Document {
  feedItemId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema = new Schema<IRating>({
  feedItemId: { type: Schema.Types.ObjectId, ref: 'FeedItem', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });

RatingSchema.index({ userId: 1, feedItemId: 1 }, { unique: true });
RatingSchema.index({ feedItemId: 1 });

const Rating: Model<IRating> =
  mongoose.models.Rating || mongoose.model<IRating>('Rating', RatingSchema);

export default Rating;