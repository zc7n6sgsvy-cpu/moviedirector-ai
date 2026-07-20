import { CREDIT_COSTS, videoCreditsForDuration, imageCredits } from '@/lib/plans';

/** Internal COGS estimate (xAI list) — ops visibility + UI honesty. */
const COST_PER_SECOND_USD = 0.05; // grok-imagine-video list
const COST_PER_IMAGE_USD = 0.02; // grok-imagine-image list

/** User-facing list price proxy when buying credits à la carte (~$0.10/credit). */
export const CREDIT_LIST_USD = 0.1;

export function estimateClipCost(durationSec: number) {
  return Math.round(durationSec * COST_PER_SECOND_USD * 100) / 100;
}

export function estimateProjectCost(shots: { duration?: number; videoUrl?: string }[]) {
  const pending = shots.filter((s) => !s.videoUrl);
  const totalSeconds = pending.reduce((sum, s) => sum + (s.duration || 8), 0);
  const totalUsd = estimateClipCost(totalSeconds);
  const credits = pending.reduce((sum, s) => sum + videoCreditsForDuration(s.duration || 8), 0);
  return {
    pendingClips: pending.length,
    totalSeconds,
    totalUsd,
    credits,
    userListUsd: Math.round(credits * CREDIT_LIST_USD * 100) / 100,
    perClipAvg: pending.length ? Math.round((totalUsd / pending.length) * 100) / 100 : 0,
    ratePerSecond: COST_PER_SECOND_USD,
    imageCredits: imageCredits(),
    videoCreditsPerSecond: CREDIT_COSTS.videoPerSecond,
  };
}

export function estimateImageCostUsd() {
  return COST_PER_IMAGE_USD;
}

export { videoCreditsForDuration, imageCredits, CREDIT_COSTS };
