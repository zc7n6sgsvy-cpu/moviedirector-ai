/**
 * MovieDirector.ai — plan catalog (episode-honest).
 *
 * User goal: 15-min sitcom episodes. Physics: xAI video ≈ $0.05/sec.
 *   15 min pure final ≈ $45 API   |  25 min pure ≈ $75 API
 *   $39 fee cannot buy 25 min continuous Grok video without losing money.
 *
 * What we promise instead (see lib/episode-economy.ts):
 *   Creator $39  — short episode / cold open cycle: ~8–12 min finished video,
 *                  hybrid assemble can feel like 12–15 min with stills + VO.
 *   Pro $99      — one 15-min episode class with retake buffer.
 *   Studio $299  — 2–3× 15-min episodes.
 *
 * Credits meter usage; the fee is the real budget. We size credits so maxing
 * final video ≈ break-even on COGS for that tier (thin margin, high retention).
 */

import {
  episodePromiseForPrice,
  pureFinalSecondsAtBreakEven,
} from '@/lib/episode-economy';

export type PlanId = 'free' | 'creator' | 'pro' | 'studio';

export type CreditPackId = 'pack_200' | 'pack_1000' | 'pack_5000';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  monthlyCredits: number;
  signupCredits: number;
  maxProjects: number;
  features: string[];
  highlighted?: boolean;
  stripePriceEnv: string | null;
  genVideoPerHour: number;
  genImagePerHour: number;
  genBatchPerHour: number;
  /** Honest product promise for billing UI */
  episodePromise?: string;
}

export interface CreditPackDefinition {
  id: CreditPackId;
  name: string;
  credits: number;
  priceUsd: number;
  stripePriceEnv: string;
  bestValue?: boolean;
}

/**
 * Credit costs — keep final video low enough that included minutes match fee.
 * 2 cr/s final → 1 min final = 120 cr. Creator 1500 cr ≈ 12.5 min pure final.
 */
export const CREDIT_COSTS = {
  image: 2,
  imageDraft: 1,
  videoPerSecond: 2,
  videoDraftPerSecond: 1,
  retakeMultiplier: 0.5,
  speech: 1,
} as const;

/** Credits to cover ~break-even pure final seconds at current video rate. */
function creditsForBreakEvenFinal(planUsd: number, buffer = 1.05): number {
  const secs = pureFinalSecondsAtBreakEven(planUsd);
  return Math.round(secs * CREDIT_COSTS.videoPerSecond * buffer);
}

const creatorPromise = episodePromiseForPrice(39);
const proPromise = episodePromiseForPrice(99);
const studioPromise = episodePromiseForPrice(299);

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Director',
    tagline: 'Plan free. Sample real Grok. No card.',
    priceMonthlyUsd: 0,
    monthlyCredits: 0,
    signupCredits: 0,
    maxProjects: 5,
    features: [
      'First Cut sample: 5 free frames + 3 free clips (on us)',
      'Unlimited free Lab — plan the whole episode before you spend',
      'Draft mode · half-price retakes · cast memory',
      'Publish sample to the feed',
      'Then trial with real episode volume',
    ],
    episodePromise: 'Sample only — then trial for volume',
    stripePriceEnv: null,
    genVideoPerHour: 4,
    genImagePerHour: 12,
    genBatchPerHour: 1,
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    tagline: 'Ship a short episode every month.',
    priceMonthlyUsd: 39,
    /**
     * ~12.5 min pure final at 2 cr/s, or ~8–9 min with heavy editing waste.
     * Hybrid sitcom assemble (stills + VO + bridges) can feel like 12–15 min.
     * NOT 25 min continuous Grok video — that alone is ~$75 API.
     */
    monthlyCredits: Math.max(1500, creditsForBreakEvenFinal(39, 1.0)),
    signupCredits: 0,
    maxProjects: 25,
    features: [
      '7-day free trial after First Cut',
      `${Math.max(1500, creditsForBreakEvenFinal(39, 1.0)).toLocaleString()} credits / month (use it or lose it)`,
      'Membership fee separate from allotment — credits do not roll over',
      creatorPromise.headline,
      'Plan free · external Grok Imagine attach free · MD credits for in-app gen + TTS',
      'Cast memory + continuity bridges + Marketing Studio',
    ],
    episodePromise: creatorPromise.headline,
    highlighted: true,
    stripePriceEnv: 'STRIPE_PRICE_CREATOR',
    genVideoPerHour: 40,
    genImagePerHour: 100,
    genBatchPerHour: 10,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'One full 15-minute episode class / month.',
    priceMonthlyUsd: 99,
    /** 15 min pure ≈ $45; with 1.5× waste ≈ $67.50 — fits $99 with margin */
    monthlyCredits: Math.max(4000, creditsForBreakEvenFinal(99, 1.15)),
    signupCredits: 0,
    maxProjects: 100,
    features: [
      `${Math.max(4000, creditsForBreakEvenFinal(99, 1.15)).toLocaleString()} credits / month`,
      proPromise.headline,
      'Retake buffer for a real 15-min cut',
      'Best top-up rate · hard batch gen',
      '100 projects · weekly drop pace',
    ],
    episodePromise: proPromise.headline,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    genVideoPerHour: 80,
    genImagePerHour: 200,
    genBatchPerHour: 20,
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: '2–3 full episodes. Series volume.',
    priceMonthlyUsd: 299,
    monthlyCredits: Math.max(12000, creditsForBreakEvenFinal(299, 1.1)),
    signupCredits: 0,
    maxProjects: 500,
    features: [
      `${Math.max(12000, creditsForBreakEvenFinal(299, 1.1)).toLocaleString()} credits / month`,
      studioPromise.headline,
      'Series / channel production volume',
      'Highest throughput · success path',
      'Custom / annual invoicing (contact)',
    ],
    episodePromise: studioPromise.headline,
    stripePriceEnv: 'STRIPE_PRICE_STUDIO',
    genVideoPerHour: 150,
    genImagePerHour: 400,
    genBatchPerHour: 40,
  },
};

export const CREDIT_PACKS: CreditPackDefinition[] = [
  {
    id: 'pack_200',
    name: 'Starter Pack',
    /** ~3+ min final top-up */
    credits: 500,
    priceUsd: 19,
    stripePriceEnv: 'STRIPE_PRICE_PACK_200',
  },
  {
    id: 'pack_1000',
    name: 'Episode Pack',
    /** Roughly another short episode of final */
    credits: 2500,
    priceUsd: 79,
    stripePriceEnv: 'STRIPE_PRICE_PACK_1000',
    bestValue: true,
  },
  {
    id: 'pack_5000',
    name: 'Series Pack',
    credits: 12000,
    priceUsd: 299,
    stripePriceEnv: 'STRIPE_PRICE_PACK_5000',
  },
];

export function speechCredits(): number {
  return CREDIT_COSTS.speech;
}

export function videoCreditsForDuration(durationSec: number): number {
  const sec = Math.min(15, Math.max(1, Math.round(durationSec || 8)));
  return sec * CREDIT_COSTS.videoPerSecond;
}

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

export function planVolumeCopy(planId: PlanId): string {
  const p = getPlan(planId);
  if (p.monthlyCredits <= 0) return 'Plan free forever · First Cut sponsored';
  const finalMin = Math.round((p.monthlyCredits / CREDIT_COSTS.videoPerSecond / 60) * 10) / 10;
  return p.episodePromise || `≈ ${finalMin} min pure final video / mo if spent only on clips`;
}
