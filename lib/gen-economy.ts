/**
 * Generation economy — makes MovieDirector viable vs free infinite Grok Imagine on X.
 *
 * Product truth:
 * - Pre-production (Lab, prompts, script, cast, shot list) is FREE forever.
 * - You only spend credits when you burn pixels (image/video API).
 * - DRAFT is for cheap iteration. FINAL is for publish-ready output.
 * - RETAKES (regenerate a shot that already has an asset) are half price so
 *   mistakes don't bankrupt the director.
 *
 * Why not unlimited like X Premium?
 * X is a sandbox for one-off prompts. MovieDirector is a production studio:
 * project memory, cast consistency, script control, continuity, publish pipeline.
 * COGS are real xAI API calls. Unlimited would kill the business.
 * The win: direct for free → generate with intention → cheap drafts when testing.
 */

import { CREDIT_COSTS } from '@/lib/plans';

export type GenQuality = 'draft' | 'final';

export const DRAFT_VIDEO_MAX_SEC = 5;

export function imageCreditsFor(quality: GenQuality = 'final', isRetake = false): number {
  const base = quality === 'draft' ? CREDIT_COSTS.imageDraft : CREDIT_COSTS.image;
  if (!isRetake) return base;
  return Math.max(1, Math.ceil(base * CREDIT_COSTS.retakeMultiplier));
}

export function videoCreditsFor(
  durationSec: number,
  quality: GenQuality = 'final',
  isRetake = false
): number {
  const cap = quality === 'draft' ? DRAFT_VIDEO_MAX_SEC : 15;
  const sec = Math.min(cap, Math.max(1, Math.round(durationSec || (quality === 'draft' ? 5 : 8))));
  const rate = quality === 'draft' ? CREDIT_COSTS.videoDraftPerSecond : CREDIT_COSTS.videoPerSecond;
  const base = sec * rate;
  if (!isRetake) return base;
  return Math.max(1, Math.ceil(base * CREDIT_COSTS.retakeMultiplier));
}

export function effectiveVideoDuration(durationSec: number, quality: GenQuality): number {
  if (quality === 'draft') {
    return Math.min(DRAFT_VIDEO_MAX_SEC, Math.max(1, Math.round(durationSec || 5)));
  }
  return Math.min(15, Math.max(1, Math.round(durationSec || 8)));
}

/** Human-readable cost lines for UI before the user spends. */
export function costExplainer() {
  return {
    freeForever: [
      'World bible, logline, concept, master script',
      'Full prompt editing (master + per-shot overrides)',
      'Character direction, continuity, shot list',
      'Style DNA, Voice Lab, Ensemble — no charge to plan',
    ],
    draft: {
      image: imageCreditsFor('draft', false),
      imageRetake: imageCreditsFor('draft', true),
      video5s: videoCreditsFor(5, 'draft', false),
      video5sRetake: videoCreditsFor(5, 'draft', true),
      note: 'Draft = cheap looks tests. Same Grok models, billed for iteration so you can fix mistakes.',
    },
    final: {
      image: imageCreditsFor('final', false),
      imageRetake: imageCreditsFor('final', true),
      video8s: videoCreditsFor(8, 'final', false),
      video8sRetake: videoCreditsFor(8, 'final', true),
      note: 'Final = publish-ready. Use after lab + draft look locked.',
    },
    vsX: {
      headline: 'X Premium = infinite random prompts. MovieDirector = a film studio.',
      body: 'On X you doodle forever. Here you build a project with cast, script, continuity, and a publish path. Planning is free. You only pay when pixels burn — and drafts + half-price retakes keep testing sane.',
    },
    /** Avoid sticker shock — lead with draft + plan value */
    newcomerPitch:
      'Plan free → test in DRAFT (a few credits) → FINAL when it feels right. Creator includes ~40 final 8s clips a month — enough for a cold open, not two lonely clips.',
  };
}
