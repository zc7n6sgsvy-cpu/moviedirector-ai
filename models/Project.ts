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
  isFirstCut?: boolean;
  firstCutPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    logline: { type: String, required: true },
    concept: String,
    synopsis: String,
    style: Schema.Types.Mixed,
    berserker: { type: Boolean, default: false },
    shots: { type: [Schema.Types.Mixed], default: [] },
    characters: { type: [Schema.Types.Mixed], default: [] },
    isPublic: { type: Boolean, default: false },
    isFirstCut: { type: Boolean, default: false, index: true },
    firstCutPath: { type: String },
  },
  {
    // Mongoose 9: use built-in timestamps — callback-style pre('save', next) crashes
    // with "TypeError: next is not a function" / "e is not a function"
    timestamps: true,
  }
);

ProjectSchema.index({ userId: 1, updatedAt: -1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
