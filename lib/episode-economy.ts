/**
 * Episode unit economics — hard truths for MovieDirector.
 *
 * xAI Imagine video list ≈ $0.05 / second of output.
 * That means pure continuous AI video:
 *   1 min  ≈ $3.00 COGS
 *  12 min  ≈ $36 COGS   ← almost the entire $39 Creator fee (no profit, no drafts)
 *  15 min  ≈ $45 COGS
 *  25 min  ≈ $75 COGS   ← cannot fit in $39 without losing money
 *
 * With editing waste (drafts + retakes) assume ~1.5× generation for 1× finished:
 *  12 min finished ≈ $54 COGS — $39 plan is a loss if they only burn pure video.
 *
 * How a $39 plan can still ship a “15-minute sitcom episode”:
 *  NOT 15 minutes of continuous regen video.
 *  Hybrid episode: shorter shots (4–6s), held stills, title cards, VO,
 *  transition bridges, only FINAL on hero beats. Planner accuracy = fewer burns.
 *  Target: ~6–10 min of FINAL video gen inside a 12–15 min assembled cut.
 *
 * Plan design targets (finished pure-video equivalent at ~break-even on fee):
 *  Creator $39  → ~8–12 min finished with discipline (hybrid episode possible)
 *  Pro $99      → ~1× 15-min episode with retake buffer
 *  Studio $299  → ~2–3× 15-min episodes
 */

export const XAI_VIDEO_COGS_PER_SEC = 0.05;
export const XAI_IMAGE_COGS = 0.02;

/** Seconds of pure final video the plan fee can buy at 1× COGS (no margin). */
export function pureFinalSecondsAtBreakEven(planUsd: number): number {
  if (planUsd <= 0) return 0;
  return Math.floor(planUsd / XAI_VIDEO_COGS_PER_SEC);
}

export function pureFinalMinutesAtBreakEven(planUsd: number): number {
  return Math.round((pureFinalSecondsAtBreakEven(planUsd) / 60) * 10) / 10;
}

/** Finished minutes if user wastes 50% on drafts/retakes (1.5× gen). */
export function finishedMinutesWithEditing(planUsd: number, wasteFactor = 1.5): number {
  return Math.round((pureFinalMinutesAtBreakEven(planUsd) / wasteFactor) * 10) / 10;
}

/**
 * Hybrid sitcom: assembled runtime can exceed pure video seconds
 * if many beats are stills / held frames / VO (planner product).
 * Rule of thumb: assembled ≈ pureFinal × hybridStretch (1.3–1.8).
 */
export function hybridAssembledMinutes(
  pureFinalMinutes: number,
  stretch = 1.5
): number {
  return Math.round(pureFinalMinutes * stretch * 10) / 10;
}

export type EpisodePromise = {
  pureFinalMin: number;
  withEditingMin: number;
  hybridEpisodeMin: number;
  headline: string;
  honestNote: string;
};

export function episodePromiseForPrice(planUsd: number): EpisodePromise {
  const pure = pureFinalMinutesAtBreakEven(planUsd);
  const edited = finishedMinutesWithEditing(planUsd, 1.5);
  const hybrid = hybridAssembledMinutes(edited, 1.5);
  return {
    pureFinalMin: pure,
    withEditingMin: edited,
    hybridEpisodeMin: hybrid,
    headline:
      planUsd <= 0
        ? 'First Cut sample only'
        : planUsd < 50
          ? `~${edited}–${hybrid} min sitcom cut / mo (hybrid + discipline)`
          : planUsd < 150
            ? `~1× 15-min episode class / mo with retake room`
            : `~2–3× 15-min episodes / mo`,
    honestNote:
      'Minutes assume Grok video COGS ~$0.05/s. Continuous 25-min pure AI video cannot fit in $39. ' +
      'A watchable 12–15 min episode is possible if you plan hard, draft first, and don’t regenerate every second.',
  };
}
