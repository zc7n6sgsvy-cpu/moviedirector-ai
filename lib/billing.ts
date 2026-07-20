import mongoose from 'mongoose';
import User, { type IUser, type PlanId } from '@/models/User';
import Project from '@/models/Project';
import UsageEvent, { type UsageEventType } from '@/models/UsageEvent';
import {
  getPlan,
  imageCredits,
  videoCreditsForDuration,
  type PlanId as CatalogPlanId,
} from '@/lib/plans';
import {
  FIRST_CUT_FREE_IMAGES,
  FIRST_CUT_FREE_VIDEOS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  TRIAL_CREDITS,
} from '@/lib/first-cut';

export class InsufficientCreditsError extends Error {
  code = 'INSUFFICIENT_CREDITS' as const;
  required: number;
  balance: number;
  /** Suggested next step for the UI funnel */
  nextStep?: 'first_cut' | 'start_trial' | 'upgrade' | 'buy_credits';

  constructor(
    required: number,
    balance: number,
    nextStep?: 'first_cut' | 'start_trial' | 'upgrade' | 'buy_credits',
    message?: string
  ) {
    super(message || `Not enough credits. Need ${required}, have ${balance}.`);
    this.required = required;
    this.balance = balance;
    this.nextStep = nextStep;
  }
}

export class ProjectLimitError extends Error {
  code = 'PROJECT_LIMIT' as const;
  max: number;

  constructor(max: number) {
    super(`Project limit reached for your plan (${max}). Upgrade to create more.`);
    this.max = max;
  }
}

export class FreeSampleExhaustedError extends Error {
  code = 'FREE_SAMPLE_EXHAUSTED' as const;
  nextStep: 'start_trial' | 'upgrade' | 'buy_credits' = 'start_trial';

  constructor(kind: 'image' | 'video') {
    super(
      kind === 'image'
        ? 'Your free First Cut frames are used up. Start a 7-day free trial to keep generating.'
        : 'Your free First Cut video clips are used up. Start a 7-day free trial to keep generating.'
    );
  }
}

type ChargeMeta = {
  description?: string;
  projectId?: string;
  jobId?: string;
  shotId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Atomically debit credits if balance is sufficient.
 * Returns the updated user document.
 */
export async function chargeCredits(
  userId: string,
  amount: number,
  type: UsageEventType,
  meta: ChargeMeta = {}
): Promise<IUser> {
  if (amount <= 0) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    return user;
  }

  // $expr + $ifNull so legacy users without creditBalance still work
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gte: [{ $ifNull: ['$creditBalance', 0] }, amount] },
    },
    {
      $inc: {
        creditBalance: -amount,
        lifetimeCreditsUsed: amount,
      },
    },
    { new: true }
  );

  if (!user) {
    const current = await User.findById(userId).select('creditBalance');
    throw new InsufficientCreditsError(amount, current?.creditBalance ?? 0);
  }

  // Normalize if field was missing before $inc
  if (user.creditBalance == null) {
    user.creditBalance = 0;
    await user.save();
  }

  await UsageEvent.create({
    userId: user._id,
    type,
    credits: -amount,
    balanceAfter: user.creditBalance,
    description: meta.description,
    projectId: meta.projectId ? new mongoose.Types.ObjectId(meta.projectId) : undefined,
    jobId: meta.jobId ? new mongoose.Types.ObjectId(meta.jobId) : undefined,
    shotId: meta.shotId,
    metadata: meta.metadata,
  });

  return user;
}

/** Credit refund (failed generation, etc.). */
export async function refundCredits(
  userId: string,
  amount: number,
  meta: ChargeMeta = {}
): Promise<IUser | null> {
  if (amount <= 0) return User.findById(userId);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        creditBalance: amount,
        lifetimeCreditsUsed: -amount,
      },
    },
    { new: true }
  );

  if (!user) return null;

  // Keep lifetime used non-negative
  if (user.lifetimeCreditsUsed < 0) {
    user.lifetimeCreditsUsed = 0;
    await user.save();
  }

  await UsageEvent.create({
    userId: user._id,
    type: 'refund',
    credits: amount,
    balanceAfter: user.creditBalance,
    description: meta.description || 'Refund for failed generation',
    projectId: meta.projectId ? new mongoose.Types.ObjectId(meta.projectId) : undefined,
    jobId: meta.jobId ? new mongoose.Types.ObjectId(meta.jobId) : undefined,
    shotId: meta.shotId,
    metadata: meta.metadata,
  });

  return user;
}

/** Grant credits (signup, plan renewal, pack purchase). */
export async function grantCredits(
  userId: string,
  amount: number,
  type: UsageEventType,
  meta: ChargeMeta & { stripeEventId?: string } = {}
): Promise<IUser | null> {
  if (amount <= 0) return User.findById(userId);

  // Idempotency for Stripe events
  if (meta.stripeEventId) {
    const existing = await UsageEvent.findOne({ stripeEventId: meta.stripeEventId });
    if (existing) return User.findById(userId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        creditBalance: amount,
        lifetimeCreditsPurchased: amount,
      },
    },
    { new: true }
  );

  if (!user) return null;

  await UsageEvent.create({
    userId: user._id,
    type,
    credits: amount,
    balanceAfter: user.creditBalance,
    description: meta.description,
    stripeEventId: meta.stripeEventId,
    metadata: meta.metadata,
  });

  return user;
}

export function estimateImageCharge(): number {
  return imageCredits();
}

export function estimateVideoCharge(durationSec: number): number {
  return videoCreditsForDuration(durationSec);
}

export function estimateBatchVideoCharge(
  shots: { duration?: number; videoUrl?: string }[]
): number {
  return shots
    .filter((s) => !s.videoUrl)
    .reduce((sum, s) => sum + videoCreditsForDuration(s.duration || 8), 0);
}

export async function assertCanCreateProject(userId: string, currentCount: number): Promise<void> {
  await expireTrialIfNeeded(userId);
  const user = await User.findById(userId).select('plan');
  const plan = getPlan(user?.plan as CatalogPlanId);
  if (currentCount >= plan.maxProjects) {
    throw new ProjectLimitError(plan.maxProjects);
  }
}

/** If platform trial expired, drop user back to free. */
export async function expireTrialIfNeeded(userId: string): Promise<IUser | null> {
  const user = await User.findById(userId);
  if (!user) return null;
  if (
    user.planStatus === 'trialing' &&
    user.trialEndsAt &&
    user.trialEndsAt.getTime() < Date.now() &&
    !user.stripeSubscriptionId
  ) {
    user.plan = 'free';
    user.planStatus = 'active';
    user.trialEndsAt = undefined;
    await user.save();
  }
  return user;
}

/**
 * Charge for generation: First Cut free allowance first, then wallet credits.
 * Returns { free: true } when sponsored by First Cut sample budget.
 */
export async function chargeGeneration(
  userId: string,
  kind: 'image' | 'video',
  creditsNeeded: number,
  meta: ChargeMeta & { projectId: string }
): Promise<{ user: IUser; free: boolean; creditsCharged: number }> {
  await expireTrialIfNeeded(userId);

  const project = await Project.findById(meta.projectId);
  if (!project) throw new Error('Project not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const isFirstCut =
    !!project.isFirstCut &&
    project.userId.toString() === userId &&
    (user.firstCutStatus === 'in_progress' || user.firstCutStatus === 'completed');

  if (isFirstCut) {
    const field =
      kind === 'image' ? 'firstCutFreeImagesRemaining' : 'firstCutFreeVideosRemaining';
    const remaining = (user as unknown as Record<string, number>)[field] ?? 0;

    if (remaining > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: userId, [field]: { $gt: 0 } },
        { $inc: { [field]: -1 } },
        { new: true }
      );
      if (updated) {
        await UsageEvent.create({
          userId: updated._id,
          type: kind === 'image' ? 'image_charge' : 'video_charge',
          credits: 0,
          balanceAfter: updated.creditBalance ?? 0,
          description: `First Cut free ${kind} (sample allowance)`,
          projectId: new mongoose.Types.ObjectId(meta.projectId),
          shotId: meta.shotId,
          metadata: { freeSample: true, kind, ...meta.metadata },
        });
        return { user: updated, free: true, creditsCharged: 0 };
      }
    }

    // First Cut free gens exhausted — try wallet, else funnel to trial
    if ((user.creditBalance ?? 0) < creditsNeeded) {
      throw new FreeSampleExhaustedError(kind);
    }
  }

  try {
    const charged = await chargeCredits(
      userId,
      creditsNeeded,
      kind === 'image' ? 'image_charge' : 'video_charge',
      {
        ...meta,
        description:
          meta.description ||
          `${kind === 'image' ? 'Image' : 'Video'} generation (${creditsNeeded} credits)`,
      }
    );
    return { user: charged, free: false, creditsCharged: creditsNeeded };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      const next =
        user.firstCutStatus === 'not_started'
          ? 'first_cut'
          : user.hasUsedTrial
            ? 'upgrade'
            : 'start_trial';
      throw new InsufficientCreditsError(
        err.required,
        err.balance,
        next,
        next === 'first_cut'
          ? 'Start your free First Cut walkthrough to generate a sample — no card needed.'
          : next === 'start_trial'
            ? 'Out of credits. Start your 7-day free Creator trial to keep generating.'
            : err.message
      );
    }
    throw err;
  }
}

/** Start platform 7-day Creator trial (used when Stripe trial checkout is not chosen / unavailable). */
export async function startPlatformTrial(userId: string): Promise<IUser> {
  await expireTrialIfNeeded(userId);
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.hasUsedTrial && user.planStatus !== 'trialing') {
    throw new Error('Free trial already used. Choose a paid plan or buy credits.');
  }
  if (user.planStatus === 'trialing' && user.trialEndsAt && user.trialEndsAt > new Date()) {
    return user; // already on trial
  }
  if (user.plan !== 'free' && user.planStatus === 'active' && user.plan !== 'creator') {
    // already on paid higher plan
    return user;
  }

  const ends = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  user.plan = TRIAL_PLAN;
  user.planStatus = 'trialing';
  user.trialEndsAt = ends;
  user.hasUsedTrial = true;
  await user.save();

  await grantCredits(userId, TRIAL_CREDITS, 'plan_grant', {
    description: `${TRIAL_DAYS}-day Creator free trial — ${TRIAL_CREDITS} credits`,
    metadata: { trial: true, days: TRIAL_DAYS },
  });

  return (await User.findById(userId))!;
}

export async function getBillingSnapshot(userId: string) {
  await expireTrialIfNeeded(userId);
  const user = await User.findById(userId).select(
    'plan planStatus creditBalance lifetimeCreditsUsed lifetimeCreditsPurchased stripeCustomerId stripeSubscriptionId currentPeriodEnd username email firstCutStatus firstCutProjectId firstCutPath firstCutFreeImagesRemaining firstCutFreeVideosRemaining firstCutCompletedAt trialEndsAt hasUsedTrial'
  );
  if (!user) return null;

  const plan = getPlan(user.plan as CatalogPlanId);
  const recent = await UsageEvent.find({ userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  const trialActive =
    user.planStatus === 'trialing' &&
    !!user.trialEndsAt &&
    user.trialEndsAt.getTime() > Date.now();

  return {
    plan: plan.id,
    planName: plan.name,
    planStatus: user.planStatus || 'active',
    priceMonthlyUsd: plan.priceMonthlyUsd,
    monthlyCredits: plan.monthlyCredits,
    creditBalance: user.creditBalance ?? 0,
    lifetimeCreditsUsed: user.lifetimeCreditsUsed ?? 0,
    lifetimeCreditsPurchased: user.lifetimeCreditsPurchased ?? 0,
    currentPeriodEnd: user.currentPeriodEnd || null,
    hasStripeCustomer: !!user.stripeCustomerId,
    hasSubscription: !!user.stripeSubscriptionId,
    firstCut: {
      status: user.firstCutStatus || 'not_started',
      projectId: user.firstCutProjectId?.toString() || null,
      path: user.firstCutPath || null,
      freeImagesRemaining: user.firstCutFreeImagesRemaining ?? FIRST_CUT_FREE_IMAGES,
      freeVideosRemaining: user.firstCutFreeVideosRemaining ?? FIRST_CUT_FREE_VIDEOS,
      completedAt: user.firstCutCompletedAt || null,
    },
    trial: {
      active: trialActive,
      endsAt: user.trialEndsAt || null,
      hasUsedTrial: !!user.hasUsedTrial,
      days: TRIAL_DAYS,
      credits: TRIAL_CREDITS,
      plan: TRIAL_PLAN,
    },
    funnel: {
      recommend:
        user.firstCutStatus === 'not_started' || user.firstCutStatus === 'skipped'
          ? 'first_cut'
          : trialActive
            ? 'create'
            : user.hasUsedTrial
              ? 'upgrade'
              : 'start_trial',
    },
    costs: {
      imageCredits: imageCredits(),
      videoCreditsPerSecond: videoCreditsForDuration(1),
      video8s: videoCreditsForDuration(8),
    },
    recentUsage: recent.map((e) => ({
      id: e._id.toString(),
      type: e.type,
      credits: e.credits,
      balanceAfter: e.balanceAfter,
      description: e.description,
      createdAt: e.createdAt,
    })),
  };
}

export async function setUserPlan(
  userId: string,
  planId: PlanId,
  opts: {
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    planStatus?: string;
    currentPeriodEnd?: Date | null;
    grantMonthlyCredits?: boolean;
    stripeEventId?: string;
  } = {}
) {
  const plan = getPlan(planId);
  const updates: Record<string, unknown> = {
    plan: plan.id,
    planStatus: opts.planStatus || 'active',
  };
  if (opts.stripeSubscriptionId !== undefined) updates.stripeSubscriptionId = opts.stripeSubscriptionId;
  if (opts.stripeCustomerId !== undefined) updates.stripeCustomerId = opts.stripeCustomerId;
  if (opts.currentPeriodEnd !== undefined) updates.currentPeriodEnd = opts.currentPeriodEnd;

  await User.findByIdAndUpdate(userId, { $set: updates });

  if (opts.grantMonthlyCredits && plan.monthlyCredits > 0) {
    await grantCredits(userId, plan.monthlyCredits, 'plan_grant', {
      description: `${plan.name} monthly credit grant`,
      stripeEventId: opts.stripeEventId,
      metadata: { planId: plan.id },
    });
  }
}
