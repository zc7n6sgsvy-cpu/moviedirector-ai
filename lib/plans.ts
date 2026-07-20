/**
 * MovieDirector.ai — commercial plan catalog.
 *
 * Pricing philosophy (director rush, not fleecing):
 *  - xAI COGS is real (~$0.02/image, ~$0.05/sec video). We cannot be free-unlimited.
 *  - New users must finish a small film feeling proud — not broke after two 8s clips.
 *  - Credits are sized so DRAFT testing is cheap and FINAL is intentional.
 *  - Membership includes enough volume for a cold open / short, not six lonely clips.
 *
 * Rough COGS check (final video @ 3 cr/s, Creator $39 / 1000 cr ≈ $0.039/cr):
 *  - 8s final ≈ 24 cr ≈ $0.94 user vs ~$0.40 xAI → healthy if average use is moderate
 *  - Draft 5s ≈ 5 cr ≈ $0.20 user vs ~$0.25 COGS → thin/loss leader for retention
 */

export type PlanId = 'free' | 'creator' | 'pro' | 'studio';

export type CreditPackId = 'pack_200' | 'pack_1000' | 'pack_5000';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  /** Credits granted every billing cycle (or once on signup for free). */
  monthlyCredits: number;
  /** One-time signup grant (free tier). */
  signupCredits: number;
  maxProjects: number;
  features: string[];
  highlighted?: boolean;
  /** Stripe Price ID env key — resolved at runtime from process.env */
  stripePriceEnv: string | null;
  /** Soft rate limits (generations per hour) on top of credits. */
  genVideoPerHour: number;
  genImagePerHour: number;
  genBatchPerHour: number;
}

export interface CreditPackDefinition {
  id: CreditPackId;
  name: string;
  credits: number;
  priceUsd: number;
  stripePriceEnv: string;
  bestValue?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Director',
    tagline: 'First Cut free. Full studio for planning. No card.',
    priceMonthlyUsd: 0,
    monthlyCredits: 0,
    signupCredits: 0,
    maxProjects: 5,
    features: [
      'Guided First Cut sample — real Grok frames + clips, on us',
      '5 free frames + 3 free video clips (platform-sponsored)',
      'Unlimited FREE Lab: plan until it feels right',
      'Draft mode cheap · retakes half price',
      'Publish your sample to the feed',
      'Then: 7-day Creator trial with real volume',
    ],
    stripePriceEnv: null,
    genVideoPerHour: 4,
    genImagePerHour: 12,
    genBatchPerHour: 1,
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    tagline: 'Finish a cold open. Feel like a director.',
    priceMonthlyUsd: 39,
    /** ~40 final 8s clips OR ~200 draft 5s tests — enough for a short sitcom cycle */
    monthlyCredits: 1000,
    signupCredits: 0,
    maxProjects: 25,
    features: [
      '7-day free trial after First Cut',
      '1,000 credits / month included',
      '≈ 40 final 8s clips · or hundreds of draft tests',
      'Draft cheap · final when locked · half-price retakes',
      'Full Lab + Ensemble cast memory',
      'Channels (serialized drops)',
    ],
    highlighted: true,
    stripePriceEnv: 'STRIPE_PRICE_CREATOR',
    genVideoPerHour: 30,
    genImagePerHour: 80,
    genBatchPerHour: 8,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Weekly drops. Agency pace.',
    priceMonthlyUsd: 99,
    monthlyCredits: 3500,
    signupCredits: 0,
    maxProjects: 100,
    features: [
      '3,500 credits / month included',
      '≈ 2+ minutes of final video / mo at full rate',
      'Best credit rate on top-ups',
      '100 projects · hard batch generation',
      'Early access to new Grok modes',
    ],
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    genVideoPerHour: 60,
    genImagePerHour: 150,
    genBatchPerHour: 15,
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'Production volume. Serious partners.',
    priceMonthlyUsd: 299,
    monthlyCredits: 12000,
    signupCredits: 0,
    maxProjects: 500,
    features: [
      '12,000 credits / month included',
      'Highest generation throughput',
      '500 projects',
      'Dedicated success path',
      'Custom invoice / annual (contact)',
    ],
    stripePriceEnv: 'STRIPE_PRICE_STUDIO',
    genVideoPerHour: 120,
    genImagePerHour: 300,
    genBatchPerHour: 30,
  },
};

/**
 * Top-up packs — slightly better $/credit than pure list so power users stay.
 * Stripe prices stay the same; more credits = better effective rate.
 */
export const CREDIT_PACKS: CreditPackDefinition[] = [
  {
    id: 'pack_200',
    name: 'Starter Pack',
    credits: 400,
    priceUsd: 19,
    stripePriceEnv: 'STRIPE_PRICE_PACK_200',
  },
  {
    id: 'pack_1000',
    name: 'Director Pack',
    credits: 2000,
    priceUsd: 79,
    stripePriceEnv: 'STRIPE_PRICE_PACK_1000',
    bestValue: true,
  },
  {
    id: 'pack_5000',
    name: 'Studio Pack',
    credits: 10000,
    priceUsd: 299,
    stripePriceEnv: 'STRIPE_PRICE_PACK_5000',
  },
];

/**
 * User-facing credit costs — tuned for "director rush" not sticker shock.
 *
 * Old (punishing): image 8, video 10/s → 8s = 80 cr → Creator 500 = ~6 clips.
 * New: draft is almost free to try; final is intentional but finishable.
 */
export const CREDIT_COSTS = {
  /** Final still */
  image: 2,
  /** Draft still — look tests */
  imageDraft: 1,
  /** Final video per second (8s = 24 cr) */
  videoPerSecond: 3,
  /** Draft video per second, capped shorter (5s = 5 cr) */
  videoDraftPerSecond: 1,
  /** Regenerating a shot that already has an asset */
  retakeMultiplier: 0.5,
  /** xAI TTS line */
  speech: 1,
} as const;

export function speechCredits(): number {
  return CREDIT_COSTS.speech;
}

/** @deprecated Prefer videoCreditsFor from gen-economy with quality */
export function videoCreditsForDuration(durationSec: number): number {
  const sec = Math.min(15, Math.max(1, Math.round(durationSec || 8)));
  return sec * CREDIT_COSTS.videoPerSecond;
}

/** @deprecated Prefer imageCreditsFor from gen-economy with quality */
export function imageCredits(): number {
  return CREDIT_COSTS.image;
}

export function getPlan(planId?: string | null): PlanDefinition {
  if (planId && planId in PLANS) return PLANS[planId as PlanId];
  return PLANS.free;
}

export function planList(): PlanDefinition[] {
  return [PLANS.free, PLANS.creator, PLANS.pro, PLANS.studio];
}

export function resolveStripePriceId(envKey: string | null | undefined): string | null {
  if (!envKey) return null;
  const val = process.env[envKey];
  return val && val.length > 0 ? val : null;
}

/** Human "what can I make" lines for billing UI. */
export function planVolumeCopy(planId: PlanId): string {
  const p = getPlan(planId);
  if (p.monthlyCredits <= 0) return 'Plan free forever · First Cut gens sponsored';
  const final8s = Math.floor(p.monthlyCredits / (CREDIT_COSTS.videoPerSecond * 8));
  const draft5s = Math.floor(p.monthlyCredits / (CREDIT_COSTS.videoDraftPerSecond * 5));
  return `≈ ${final8s} final 8s clips · or ≈ ${draft5s} draft 5s tests / month`;
}
