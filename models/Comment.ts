import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IComment extends Document {
  feedItemId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  content: string;
  parentId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>({
  feedItemId: { type: Schema.Types.ObjectId, ref: 'FeedItem', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  content: { type: String, required: true, maxlength: 2000 },
  parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
  createdAt: { type: Date, default: Date.now },
});

CommentSchema.index({ feedItemId: 1, createdAt: -1 });
CommentSchema.index({ parentId: 1 });

const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;