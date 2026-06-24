import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  content: string;
  filmId?: string; // optional link to a film/project
  createdAt: Date;
  read: boolean;
}

const MessageSchema: Schema = new Schema({
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  filmId: { type: String },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

MessageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
MessageSchema.index({ toUserId: 1, read: 1 });

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
