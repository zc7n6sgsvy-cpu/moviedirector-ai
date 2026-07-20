/**
 * Marketing Studio — short-form / ads / brand films with MD precision.
 *
 * Higgs sells a clip factory. We sell a brand desk:
 * offer + audience + CTA + cast/world memory → timed beats → draft/final spend.
 * Same Lab accuracy stack, compressed for 6–60s deliverables.
 */

import type { Project, ProjectType, Shot } from '@/lib/types';

export type AdFormatId =
  | 'bumper-6'
  | 'tiktok-15'
  | 'reel-15'
  | 'story-15'
  | 'spot-30'
  | 'yt-midroll-30'
  | 'launch-60';

export interface AdFormat {
  id: AdFormatId;
  label: string;
  platform: string;
  totalSec: number;
  aspectRatio: string;
  beatCount: number;
  purpose: string;
}

export const AD_FORMATS: AdFormat[] = [
  {
    id: 'bumper-6',
    label: '6s bumper',
    platform: 'YouTube / CTV',
    totalSec: 6,
    aspectRatio: '16:9',
    beatCount: 2,
    purpose: 'Logo + one claim. Zero waste.',
  },
  {
    id: 'tiktok-15',
    label: '15s TikTok / Reels',
    platform: 'TikTok · IG · Shorts',
    totalSec: 15,
    aspectRatio: '9:16',
    beatCount: 4,
    purpose: 'Hook → demo → proof → CTA.',
  },
  {
    id: 'reel-15',
    label: '15s vertical ad',
    platform: 'Meta · paid social',
    totalSec: 15,
    aspectRatio: '9:16',
    beatCount: 4,
    purpose: 'Scroll-stop → product → offer → swipe.',
  },
  {
    id: 'story-15',
    label: '15s story',
    platform: 'IG / Snap stories',
    totalSec: 15,
    aspectRatio: '9:16',
    beatCount: 3,
    purpose: 'Full-bleed product moment + sticker CTA energy.',
  },
  {
    id: 'spot-30',
    label: '30s brand spot',
    platform: 'Web · paid · launch',
    totalSec: 30,
    aspectRatio: '16:9',
    beatCount: 5,
    purpose: 'Story beat commercial with clear offer.',
  },
  {
    id: 'yt-midroll-30',
    label: '30s YouTube',
    platform: 'YouTube mid-roll',
    totalSec: 30,
    aspectRatio: '16:9',
    beatCount: 5,
    purpose: 'Skippable structure: hook hard in 5s.',
  },
  {
    id: 'launch-60',
    label: '60s launch film',
    platform: 'Site hero · X · launch',
    totalSec: 60,
    aspectRatio: '16:9',
    beatCount: 6,
    purpose: 'Mini-trailer for product or personal brand.',
  },
];

export interface BrandKit {
  brandName?: string;
  product?: string;
  audience?: string;
  offer?: string;
  cta?: string;
  tone?: string;
  visualLaws?: string;
  /** What the brand never does on camera */
  never?: string;
  competitorsAvoid?: string;
  urlOrHandle?: string;
}

export interface AdBeat {
  title: string;
  seconds: number;
  job: string;
  /** Shot description seed */
  description: string;
  camera: string;
  dialogue?: string;
  emotion?: string;
}

export function getAdFormat(id: AdFormatId): AdFormat {
  return AD_FORMATS.find((f) => f.id === id) || AD_FORMATS[1];
}

/** Build timed beats from brand kit + format (precision short-form). */
export function buildAdBeats(kit: BrandKit, format: AdFormat): AdBeat[] {
  const brand = kit.brandName?.trim() || 'the brand';
  const product = kit.product?.trim() || 'the product';
  const offer = kit.offer?.trim() || 'the offer';
  const cta = kit.cta?.trim() || 'Learn more';
  const audience = kit.audience?.trim() || 'the audience';
  const tone = kit.tone?.trim() || 'sharp, modern, confident';

  const sec = format.totalSec;
  const n = format.beatCount;
  const slice = Math.max(2, Math.round(sec / n));

  const library: AdBeat[] = [
    {
      title: 'HOOK',
      seconds: Math.min(slice, 5),
      job: 'Stop the scroll in under 2 seconds',
      description: `Cold open for ${brand}: pattern interrupt that speaks to ${audience}. ${tone}. Product ${product} hinted, not explained yet.`,
      camera: 'Aggressive push-in or smash cut',
      emotion: 'Curiosity + tension',
      dialogue: undefined,
    },
    {
      title: 'PROBLEM',
      seconds: slice,
      job: 'Name the pain the offer solves',
      description: `Relatable friction for ${audience} — the world without ${product}. Keep it human, never generic stock misery.`,
      camera: 'Handheld or tight insert',
      emotion: 'Recognition',
    },
    {
      title: 'PRODUCT',
      seconds: slice,
      job: 'Show the product doing the work',
      description: `Hero demonstration of ${product} for ${brand}. Clear, readable, one idea. Visual laws: ${kit.visualLaws || 'brand-consistent'}.`,
      camera: 'Clean product hero / medium',
      emotion: 'Clarity + desire',
    },
    {
      title: 'PROOF',
      seconds: slice,
      job: 'Social proof or transformation beat',
      description: `Proof moment for ${brand}: result, reaction, or before/after energy. Still original world — no fake celebrity endorsements.`,
      camera: 'Reaction close-up or split energy',
      emotion: 'Relief / delight',
    },
    {
      title: 'OFFER',
      seconds: slice,
      job: 'State the offer cleanly',
      description: `Offer lock: ${offer}. On-screen energy, readable. Never clutter.`,
      camera: 'Graphic-friendly wide or title-safe medium',
      dialogue: offer,
      emotion: 'Urgency without sleaze',
    },
    {
      title: 'CTA',
      seconds: Math.min(slice, 5),
      job: 'Single call to action',
      description: `End card energy for ${brand}. CTA: ${cta}. ${kit.urlOrHandle ? `Handle/URL energy: ${kit.urlOrHandle}.` : ''} Hold for end card.`,
      camera: 'Locked off end card framing',
      dialogue: cta,
      emotion: 'Decisive',
    },
  ];

  // Pick a coherent subset matching beatCount
  const picks: AdBeat[] =
    n <= 2
      ? [library[0], library[5]]
      : n === 3
        ? [library[0], library[2], library[5]]
        : n === 4
          ? [library[0], library[1], library[2], library[5]]
          : n === 5
            ? [library[0], library[1], library[2], library[4], library[5]]
            : library;

  // Normalize durations to sum ≈ totalSec
  const sum = picks.reduce((a, b) => a + b.seconds, 0);
  const scale = sec / sum;
  return picks.map((b) => ({
    ...b,
    seconds: Math.max(2, Math.round(b.seconds * scale)),
  }));
}

export function beatsToShots(beats: AdBeat[], idFactory: () => string): Shot[] {
  return beats.map((b, i) => ({
    id: idFactory(),
    number: i + 1,
    description: `[${b.title}] ${b.description}`,
    camera: b.camera,
    duration: b.seconds,
    dialogue: b.dialogue,
    emotion: b.emotion,
    actingCues: b.job,
    styleNotes: 'Marketing Studio beat — one job per shot',
    shotKind: 'story',
  }));
}

export function applyMarketingPlanToProject(
  project: Project,
  kit: BrandKit,
  formatId: AdFormatId,
  idFactory: () => string
): Project {
  const format = getAdFormat(formatId);
  const beats = buildAdBeats(kit, format);
  const shots = beatsToShots(beats, idFactory);
  const brand = kit.brandName || project.title;
  const type: ProjectType =
    project.type === 'brand-fusion' ? 'brand-fusion' : 'commercial';

  const concept = [
    `Marketing Studio · ${format.label} (${format.totalSec}s ${format.aspectRatio})`,
    kit.product && `Product: ${kit.product}`,
    kit.audience && `Audience: ${kit.audience}`,
    kit.offer && `Offer: ${kit.offer}`,
    kit.cta && `CTA: ${kit.cta}`,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    ...project,
    type,
    title: project.title || `${brand} — ${format.label}`,
    logline:
      project.logline?.trim() ||
      `${brand}: ${kit.offer || kit.product || 'brand film'} for ${kit.audience || 'your audience'} — ${format.totalSec}s.`,
    concept,
    style: {
      ...project.style,
      description:
        project.style?.description ||
        [kit.visualLaws, kit.tone && `Tone: ${kit.tone}`, kit.never && `Never: ${kit.never}`]
          .filter(Boolean)
          .join('. ') ||
        project.style?.description,
    },
    worldBible: {
      ...project.worldBible,
      audience: kit.audience || project.worldBible?.audience,
      tone: kit.tone || project.worldBible?.tone,
      visualLaws: kit.visualLaws || project.worldBible?.visualLaws,
      whatNever: kit.never || project.worldBible?.whatNever,
      northStar: kit.cta ? `Every beat serves CTA: ${kit.cta}` : project.worldBible?.northStar,
    },
    generationSettings: {
      ...project.generationSettings,
      workflowMode: 'auto',
      defaultQuality: 'draft',
      aspectRatio: format.aspectRatio,
      masterPrompt: [
        project.generationSettings?.masterPrompt,
        kit.brandName && `Brand: ${kit.brandName}`,
        kit.visualLaws,
        kit.never && `Avoid: ${kit.never}`,
      ]
        .filter(Boolean)
        .join('. '),
      promptSuffix: kit.cta ? `End-state CTA energy: ${kit.cta}` : project.generationSettings?.promptSuffix,
      negativePrompt: [project.generationSettings?.negativePrompt, kit.competitorsAvoid, kit.never]
        .filter(Boolean)
        .join('. '),
    },
    brandKit: kit,
    adFormatId: formatId,
    shots,
    synopsis: beats.map((b) => `${b.title} (${b.seconds}s): ${b.job}`).join('\n'),
  };
}

/** Credit estimate helper for UI (uses final 2 cr/s style if passed). */
export function estimateAdCredits(
  totalSec: number,
  opts: { draft?: boolean; crPerSecFinal?: number; crPerSecDraft?: number } = {}
): { draft: number; final: number } {
  const d = opts.crPerSecDraft ?? 1;
  const f = opts.crPerSecFinal ?? 2;
  return {
    draft: Math.ceil(totalSec * d),
    final: Math.ceil(totalSec * f),
  };
}
