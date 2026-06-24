import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  type: string;
  logline: string;
  concept?: string;
  synopsis?: string;
  style?: any;
  berserker: boolean;
  shots: any[];
  characters?: any[];
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  logline: { type: String, required: true },
  concept: String,
  synopsis: String,
  style: Schema.Types.Mixed,
  berserker: { type: Boolean, default: false },
  shots: [Schema.Types.Mixed],
  characters: [Schema.Types.Mixed],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ProjectSchema.pre('save', function(this: any, next: any) {
  this.updatedAt = new Date();
  next();
});

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
