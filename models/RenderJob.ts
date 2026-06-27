import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRenderJob extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'done' | 'failed';
  clipUrls: string[];
  outputUrl?: string;
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RenderJobSchema = new Schema<IRenderJob>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
  clipUrls: [String],
  outputUrl: String,
  progress: { type: Number, default: 0 },
  error: String,
}, { timestamps: true });

const RenderJob: Model<IRenderJob> =
  mongoose.models.RenderJob || mongoose.model<IRenderJob>('RenderJob', RenderJobSchema);

export default RenderJob;