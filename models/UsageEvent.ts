import mongoose, { Schema, Document, Model } from 'mongoose';

export type UsageEventType =
  | 'signup_grant'
  | 'plan_grant'
  | 'pack_purchase'
  | 'image_charge'
  | 'video_charge'
  | 'batch_reserve'
  | 'refund'
  | 'admin_adjust';

export interface IUsageEvent extends Document {
  userId: mongoose.Types.ObjectId;
  type: UsageEventType;
  /** Positive = credits added, negative = credits spent. */
  credits: number;
  balanceAfter: number;
  description?: string;
  projectId?: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId;
  shotId?: string;
  stripeEventId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'signup_grant',
        'plan_grant',
        'pack_purchase',
        'image_charge',
        'video_charge',
        'batch_reserve',
        'refund',
        'admin_adjust',
      ],
      required: true,
      index: true,
    },
    credits: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: String,
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    jobId: { type: Schema.Types.ObjectId, ref: 'GenerationJob' },
    shotId: String,
    stripeEventId: { type: String, index: true, sparse: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UsageEventSchema.index({ userId: 1, createdAt: -1 });

const UsageEvent: Model<IUsageEvent> =
  mongoose.models.UsageEvent || mongoose.model<IUsageEvent>('UsageEvent', UsageEventSchema);

export default UsageEvent;
