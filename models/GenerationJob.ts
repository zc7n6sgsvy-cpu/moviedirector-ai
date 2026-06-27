import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGenerationJobItem {
  shotId: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
}

export interface IGenerationJob extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  type: 'batch' | 'single';
  status: 'pending' | 'processing' | 'done' | 'failed';
  mode: 'image' | 'video' | 'batch-video';
  items: IGenerationJobItem[];
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, enum: ['batch', 'single'], default: 'single' },
  status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
  mode: { type: String, enum: ['image', 'video', 'batch-video'], required: true },
  items: [{
    shotId: String,
    status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending' },
    prompt: String,
    imageUrl: String,
    videoUrl: String,
    error: String,
  }],
  progress: { type: Number, default: 0 },
  error: String,
}, { timestamps: true });

const GenerationJob: Model<IGenerationJob> =
  mongoose.models.GenerationJob || mongoose.model<IGenerationJob>('GenerationJob', GenerationJobSchema);

export default GenerationJob;