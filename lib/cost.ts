const COST_PER_SECOND_USD = 0.06;

export function estimateClipCost(durationSec: number) {
  return Math.round(durationSec * COST_PER_SECOND_USD * 100) / 100;
}

export function estimateProjectCost(shots: { duration?: number; videoUrl?: string }[]) {
  const pending = shots.filter((s) => !s.videoUrl);
  const totalSeconds = pending.reduce((sum, s) => sum + (s.duration || 8), 0);
  const totalUsd = estimateClipCost(totalSeconds);
  return {
    pendingClips: pending.length,
    totalSeconds,
    totalUsd,
    perClipAvg: pending.length ? Math.round((totalUsd / pending.length) * 100) / 100 : 0,
    ratePerSecond: COST_PER_SECOND_USD,
  };
}