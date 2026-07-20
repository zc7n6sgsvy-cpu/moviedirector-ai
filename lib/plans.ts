/**
 * MovieDirector.ai — commercial plan catalog.
 *
 * Model for big MRR:
 *  1. Membership fee (monthly subscription) → predictable base revenue
 *  2. Usage credits (included + top-ups) → scales with generation volume
 *  3. Optional channel prices (creator-set) → future marketplace take-rate
 *
 * Credits are the unit of generation. ~1 credit ≈ $0.10 list when buying packs;
 * memberships grant credits at a better effective rate to drive upgrades.
 *
 * Economy vs free Grok Imagine on X:
 *  - Lab / prompts / script / cast = FREE (no API burn)
 *  - Draft gens = cheap iteration; Final = full rate; Retakes = half price
 *  - See lib/gen-economy.ts
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
    /** No general wallet on free — free gens come from First Cut allowance. */
    signupCredits: 0,
    maxProjects: 5,
    features: [
      'Guided First Cut sample (sitcom / film / commercial / trailer)',
      '3 free frames + 2 free video clips (platform-sponsored)',
      'Unlimited FREE Lab: world, script, master prompts, cast, continuity',
      'Draft mode + half-price retakes when you fix a shot',
      'Public feed, Social Studio, publish your sample',
      'Then: 7-day Creator trial → paid',
    ],
    stripePriceEnv: null,
    genVideoPerHour: 4,
    genImagePerHour: 12,
    genBatchPerHour: 1,
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    tagline: 'Personal brand cinema on a schedule.',
    priceMonthlyUsd: 39,
    monthlyCredits: 500,
    signupCredits: 0,
    maxProjects: 25,
    features: [
      '7-day free trial available after First Cut',
      '500 credits / month included',
      'Draft gens cheap · final when locked · half-price retakes',
      'Full prompt control + Lab pre-production (free)',
      'Full episodes + batch generation',
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
    tagline: 'Agencies & high-output creators.',
    priceMonthlyUsd: 99,
    monthlyCredits: 2000,
    signupCredits: 0,
    maxProjects: 100,
    features: [
      '2,000 credits / month included',
      'Best credit rate on top-ups',
      '100 projects',
      'Batch generation unlocked hard',
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
    tagline: 'Production volume. Serious MRR partners.',
    priceMonthlyUsd: 299,
    monthlyCredits: 8000,
    signupCredits: 0,
    maxProjects: 500,
    features: [
      '8,000 credits / month included',
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

export const CREDIT_PACKS: CreditPackDefinition[] = [
  {
    id: 'pack_200',
    name: 'Starter Pack',
    credits: 200,
    priceUsd: 19,
    stripePriceEnv: 'STRIPE_PRICE_PACK_200',
  },
  {
    id: 'pack_1000',
    name: 'Director Pack',
    credits: 1000,
    priceUsd: 79,
    stripePriceEnv: 'STRIPE_PRICE_PACK_1000',
    bestValue: true,
  },
  {
    id: 'pack_5000',
    name: 'Studio Pack',
    credits: 5000,
    priceUsd: 299,
    stripePriceEnv: 'STRIPE_PRICE_PACK_5000',
  },
];

/**
 * How many credits each generation action costs.
 * Draft rates subsidize iteration (thinner margin, better retention).
 * Retakes use retakeMultiplier so mistakes are recoverable.
 */
export const CREDIT_COSTS = {
  /** Final-quality still */
  image: 8,
  /** Draft still — iterate looks without burning the wallet */
  imageDraft: 3,
  /** Final video per second of requested duration */
  videoPerSecond: 10,
  /** Draft video per second (capped shorter in gen-economy) */
  videoDraftPerSecond: 4,
  /** Regenerating a shot that already has an asset */
  retakeMultiplier: 0.5,
  /** xAI TTS line (~cheap vs video; list rate is $/char) */
  speech: 2,
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
