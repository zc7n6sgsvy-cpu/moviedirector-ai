/**
 * First Cut — free guided sample that converts to trial → paid.
 *
 * Design principles:
 * 1. Free forever for feed + pre-production (planning feels unlimited).
 * 2. One free "First Cut" sample with real Grok generations (capped COGS).
 * 3. Sample is complete enough to share / publish (dopamine + proof).
 * 4. After sample: 7-day Creator trial → paid membership + usage.
 */

import type { ProjectType, Shot } from '@/lib/types';

export type FirstCutPathId =
  | 'sitcom-pilot'
  | 'short-film'
  | 'commercial'
  | 'launch-trailer';

export type FirstCutStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/** Free generation budget for the First Cut sample (platform-sponsored). */
export const FIRST_CUT_FREE_IMAGES = 3;
export const FIRST_CUT_FREE_VIDEOS = 2;
/** Short clips keep COGS predictable while still feeling cinematic. */
export const FIRST_CUT_VIDEO_SECONDS = 6;

/** Platform trial after First Cut (or skip). */
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: 'creator' = 'creator';
export const TRIAL_CREDITS = 500;

export interface FirstCutPath {
  id: FirstCutPathId;
  label: string;
  eyebrow: string;
  promise: string;
  projectType: ProjectType;
  /** Questions shown in the walkthrough (short, high-signal). */
  prompts: { key: string; label: string; placeholder: string; required?: boolean }[];
  /** How we describe the free sample outcome. */
  sampleOutcome: string;
}

export const FIRST_CUT_PATHS: FirstCutPath[] = [
  {
    id: 'sitcom-pilot',
    label: 'Sitcom pilot cold open',
    eyebrow: 'SERIES',
    promise: 'Build the cold open + title sting of your pilot episode.',
    projectType: 'sitcom',
    sampleOutcome: '3-shot pilot sample: cold open, title card, A-plot launch (2 free video clips).',
    prompts: [
      { key: 'showTitle', label: 'Show title', placeholder: 'e.g. Night Shift at the Museum', required: true },
      { key: 'lead', label: 'Lead character', placeholder: 'Who is the show about?', required: true },
      { key: 'world', label: 'World / workplace', placeholder: 'Where does the chaos live?', required: true },
      { key: 'joke', label: 'The terrible idea', placeholder: 'What dumb/brilliant plan kicks off the pilot?', required: true },
    ],
  },
  {
    id: 'short-film',
    label: 'Short film pilot beat',
    eyebrow: 'FILM',
    promise: 'Direct a self-contained emotional short — opening, turn, final image.',
    projectType: 'film',
    sampleOutcome: '3-shot short: opening image, irreversible choice, final frame (2 free video clips).',
    prompts: [
      { key: 'title', label: 'Film title', placeholder: 'e.g. Last Light on 7th', required: true },
      { key: 'protagonist', label: 'Protagonist', placeholder: 'Who changes by the end?', required: true },
      { key: 'want', label: 'What they want', placeholder: 'Desire in one line', required: true },
      { key: 'turn', label: 'The turn', placeholder: 'What cannot be undone?', required: true },
    ],
  },
  {
    id: 'commercial',
    label: 'Brand commercial',
    eyebrow: 'BRAND',
    promise: 'A scroll-stopping 30s brand film: hook → tension → product truth → sting.',
    projectType: 'commercial',
    sampleOutcome: '4-shot commercial sample with 2 free motion clips + hero frames.',
    prompts: [
      { key: 'brand', label: 'Brand / product', placeholder: 'What are we selling the feeling of?', required: true },
      { key: 'audience', label: 'Who is this for?', placeholder: 'Ideal customer in plain words', required: true },
      { key: 'truth', label: 'Human truth', placeholder: 'The real tension this brand solves', required: true },
      { key: 'line', label: 'Final line (optional)', placeholder: 'Tagline or CTA line' },
    ],
  },
  {
    id: 'launch-trailer',
    label: 'Launch trailer',
    eyebrow: 'TRAILER',
    promise: 'Trailer energy for a movie, product, brand, or anything you are launching.',
    projectType: 'film',
    sampleOutcome: '4-beat trailer: hook, world, stakes, title card — 2 free video clips.',
    prompts: [
      { key: 'launch', label: 'What are you launching?', placeholder: 'Film, app, brand, fundraise, event…', required: true },
      { key: 'title', label: 'Title / name', placeholder: 'On-screen name', required: true },
      { key: 'vibe', label: 'Tone', placeholder: 'e.g. premium, chaotic, intimate, epic', required: true },
      { key: 'stakes', label: 'Why it matters now', placeholder: 'The urgency / promise', required: true },
    ],
  },
];

export function getFirstCutPath(id: string): FirstCutPath | undefined {
  return FIRST_CUT_PATHS.find((p) => p.id === id);
}

type Answers = Record<string, string>;

function clean(s: string) {
  return (s || '').trim();
}

/**
 * Build a complete project payload from walkthrough answers.
 * Intentionally SHORT shot lists so free gens can finish the sample.
 */
export function buildFirstCutProject(
  pathId: FirstCutPathId,
  answers: Answers
): {
  title: string;
  type: ProjectType;
  logline: string;
  concept: string;
  synopsis: string;
  style: { description: string };
  berserker: boolean;
  shots: Omit<Shot, 'id'>[];
  firstCutPath: FirstCutPathId;
  isFirstCut: true;
} {
  const path = getFirstCutPath(pathId);
  if (!path) throw new Error('Invalid First Cut path');

  const a = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, clean(v)]));

  if (pathId === 'sitcom-pilot') {
    const title = a.showTitle || 'Untitled Pilot';
    const logline = `${a.lead} works ${a.world || 'somewhere impossible'} and decides to ${a.joke || 'try something terrible'}.`;
    return {
      title,
      type: 'sitcom',
      logline,
      concept: `Pilot sample of a sitcom pilot cold open. Lead: ${a.lead}. World: ${a.world}. Inciting idea: ${a.joke}.`,
      synopsis: `${title} — pilot sample.\n\n${logline}\n\nThis First Cut includes the cold open, title sting, and A-plot launch — enough to feel the show.`,
      style: {
        description:
          'Half-hour network/streaming sitcom look: warm practicals, clean comedy framing, slight heightened reality, emotional truth under the jokes.',
      },
      berserker: false,
      firstCutPath: pathId,
      isFirstCut: true,
      shots: [
        {
          number: 1,
          description: `COLD OPEN — ${a.lead} in ${a.world || 'their world'}. The ridiculous setup for: ${a.joke}. Tight on face, then smash into chaos.`,
          camera: 'Close-up → whip pan',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'panic masked as confidence',
          dialogue: a.joke ? `"What if we just… ${a.joke}?"` : undefined,
        },
        {
          number: 2,
          description: `TITLE CARD + THEME STING. Ensemble tableau for "${title}". Bold type, punchy color, sitcom energy.`,
          camera: 'Wide, locked off',
          duration: FIRST_CUT_VIDEO_SECONDS,
          styleNotes: 'Title treatment readable on mobile.',
        },
        {
          number: 3,
          description: `A-PLOT LAUNCH — ${a.lead} commits to the terrible idea. Friends/coworkers react. The pilot is officially on.`,
          camera: 'Medium, tracking push-in',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'momentum, dread, comedy',
        },
      ],
    };
  }

  if (pathId === 'short-film') {
    const title = a.title || 'Untitled Short';
    const logline = `${a.protagonist} wants ${a.want}, until ${a.turn}.`;
    return {
      title,
      type: 'film',
      logline,
      concept: `Cinematic short sample. Protagonist: ${a.protagonist}. Desire: ${a.want}. Irreversible turn: ${a.turn}.`,
      synopsis: `${title}\n\n${logline}\n\nFirst Cut focuses on opening image, the choice that cannot be undone, and the final image.`,
      style: {
        description:
          'Independent short film: 35mm texture, naturalistic light, precise composition, emotional clarity without exposition.',
      },
      berserker: false,
      firstCutPath: pathId,
      isFirstCut: true,
      shots: [
        {
          number: 1,
          description: `OPENING IMAGE — ${a.protagonist}. Theme in metaphor. Desire under the surface: ${a.want}.`,
          camera: 'Static wide or macro detail',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'quiet hunger',
        },
        {
          number: 2,
          description: `THE TURN — ${a.turn}. A choice or event that cannot be undone.`,
          camera: 'Locked. Sudden push.',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'shock, resolve',
        },
        {
          number: 3,
          description: `FINAL IMAGE — ${a.protagonist} changed forever, shown not said. Echo of the opening.`,
          camera: 'Final wide or extreme close',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'afterglow or aftermath',
        },
      ],
    };
  }

  if (pathId === 'commercial') {
    const brand = a.brand || 'the brand';
    const title = `${brand} — Brand Film`;
    const logline = `For ${a.audience || 'people who care'}: ${a.truth || 'a human truth'} — solved by ${brand}.`;
    return {
      title,
      type: 'commercial',
      logline,
      concept: `30s brand film. Brand: ${brand}. Audience: ${a.audience}. Human truth: ${a.truth}. Line: ${a.line || 'n/a'}.`,
      synopsis: `${title}\n\n${logline}\n\nHook → tension → elegant product truth → sting.`,
      style: {
        description:
          'Premium commercial cinema: high contrast, intentional color grade, human faces first, product as elegant solution not the hero.',
      },
      berserker: false,
      firstCutPath: pathId,
      isFirstCut: true,
      shots: [
        {
          number: 1,
          description: `HOOK — Scroll-stopping human truth: ${a.truth}. No logo yet.`,
          camera: 'Bold close or impossible wide',
          duration: FIRST_CUT_VIDEO_SECONDS,
          emotion: 'recognition',
        },
        {
          number: 2,
          description: `TENSION — ${a.audience} feel the cost of the problem. Real people, real stakes.`,
          camera: 'Naturalistic handheld',
          duration: FIRST_CUT_VIDEO_SECONDS,
        },
        {
          number: 3,
          description: `BRAND ARRIVES — ${brand} as the elegant solution, never shouting.`,
          camera: 'Elegant product reveal',
          duration: FIRST_CUT_VIDEO_SECONDS,
        },
        {
          number: 4,
          description: `STING — Logo lockup. ${a.line ? `Final line: "${a.line}"` : 'Clean. Confident.'}`,
          camera: 'Centered lockup',
          duration: 4,
          dialogue: a.line || undefined,
        },
      ],
    };
  }

  // launch-trailer
  const launch = a.launch || 'the launch';
  const title = a.title || 'Untitled Launch';
  const logline = `Trailer for ${launch}: ${a.stakes}. Tone: ${a.vibe || 'cinematic'}.`;
  return {
    title: `${title} — Trailer`,
    type: 'film',
    logline,
    concept: `Launch trailer for ${launch}. Title: ${title}. Vibe: ${a.vibe}. Stakes: ${a.stakes}.`,
    synopsis: `Trailer cut for ${title}.\n\n${logline}\n\nBeats: hook world → tension → stakes → title card.`,
    style: {
      description: `Trailer grade, ${a.vibe || 'cinematic'} energy, kinetic cuts, bold title typography, launch-ready social + web hero.`,
    },
    berserker: false,
    firstCutPath: pathId,
    isFirstCut: true,
    shots: [
      {
        number: 1,
        description: `HOOK — Instant atmosphere for ${title}. Promise of ${launch}.`,
        camera: 'Hero establishing',
        duration: FIRST_CUT_VIDEO_SECONDS,
        styleNotes: a.vibe,
      },
      {
        number: 2,
        description: `WORLD — The texture of what is being launched. Details that make it real.`,
        camera: 'Montage-friendly mediums',
        duration: FIRST_CUT_VIDEO_SECONDS,
      },
      {
        number: 3,
        description: `STAKES — Why now: ${a.stakes}. Escalation, urgency, emotion.`,
        camera: 'Push-in / faster energy',
        duration: FIRST_CUT_VIDEO_SECONDS,
        emotion: 'urgency',
      },
      {
        number: 4,
        description: `TITLE CARD — "${title}". Launch ready. End card energy.`,
        camera: 'Centered lockup',
        duration: 4,
      },
    ],
  };
}

export const FIRST_CUT_JOURNEY_COPY = {
  heroCta: 'Create your free First Cut',
  heroSub:
    'No card required. Walk through a sitcom pilot, short film, commercial, or launch trailer — and generate a real sample with Grok.',
  afterSample:
    'Your sample is ready. Start a 7-day free trial to unlock full episodes, batch generation, and monthly credits.',
  trialPitch:
    '7 days of Creator free. 500 credits. Cancel before day 8 and you pay nothing if you cancel during trial (Stripe trial).',
};
