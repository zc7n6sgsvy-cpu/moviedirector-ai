import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlanId = 'free' | 'creator' | 'pro' | 'studio';
export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
export type FirstCutStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface IUser extends Document {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  passwordHash: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;

  // Billing
  plan: PlanId;
  planStatus: PlanStatus;
  creditBalance: number;
  lifetimeCreditsUsed: number;
  lifetimeCreditsPurchased: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;

  // Free sample → trial funnel
  firstCutStatus: FirstCutStatus;
  firstCutProjectId?: mongoose.Types.ObjectId;
  firstCutPath?: string;
  firstCutFreeImagesRemaining: number;
  firstCutFreeVideosRemaining: number;
  firstCutCompletedAt?: Date;
  trialEndsAt?: Date;
  hasUsedTrial: boolean;
  onboardingStep?: string;

  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, index: true },
  displayName: { type: String, trim: true },
  bio: { type: String, maxlength: 300 },
  avatarUrl: { type: String },
  email: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  resetPasswordToken: { type: String, index: true },
  resetPasswordExpires: { type: Date },

  plan: {
    type: String,
    enum: ['free', 'creator', 'pro', 'studio'],
    default: 'free',
    index: true,
  },
  planStatus: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete'],
    default: 'active',
  },
  creditBalance: { type: Number, default: 0, min: 0 },
  lifetimeCreditsUsed: { type: Number, default: 0, min: 0 },
  lifetimeCreditsPurchased: { type: Number, default: 0, min: 0 },
  stripeCustomerId: { type: String, index: true, sparse: true },
  stripeSubscriptionId: { type: String, index: true, sparse: true },
  currentPeriodEnd: { type: Date },

  firstCutStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'skipped'],
    default: 'not_started',
    index: true,
  },
  firstCutProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  firstCutPath: { type: String },
  firstCutFreeImagesRemaining: { type: Number, default: 5 },
  firstCutFreeVideosRemaining: { type: Number, default: 3 },
  firstCutCompletedAt: { type: Date },
  trialEndsAt: { type: Date },
  hasUsedTrial: { type: Boolean, default: false },
  onboardingStep: { type: String },

  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
