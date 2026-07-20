/**
 * BERSERKER MODE — MovieDirector's secret signature.
 *
 * Not a quality slider. Not "HDR on."
 * Summoning an S-tier myth character you never fully control.
 * Directors engage it knowing: they will not get safe.
 *
 * Rules:
 * - Same pipeline (Grok image/video) — the *creative gravity* flips.
 * - Unpredictable shot DNA, prompt mutations, character voltage.
 * - Still original IP only — chaos ≠ stealing.
 */

import type { ProjectType, Shot } from '@/lib/types';

/** Myth tags injected into prompts — rotate so gens never feel templated. */
const MYTH_ASPECTS = [
  'a god walking in street clothes',
  'a prophecy that arrives as a joke',
  'the room breathing like a living thing',
  'beauty that feels slightly wrong',
  'a secret the camera almost refuses to show',
  'comic timing from another dimension',
  'myth leaking through fluorescent lights',
  'an S-tier presence that rewrites the scene',
  'chaos with perfect composition',
  'the last honest frame before the world tilts',
  'sacred trash aesthetics',
  'a legend that has not chosen its form yet',
] as const;

const CAMERA_CURSES = [
  'Impossible angle that still feels intentional',
  'Lens that hunts emotion, not coverage',
  'Crash zoom into the soul of the joke',
  'Orbit as if gravity renegotiated',
  'Static hold until the silence becomes violence',
  'Dutch angle that earns its keep',
  'Macro detail that swallows the story',
  'God-shot that refuses to flatter',
] as const;

const EMOTION_STORMS = [
  'divine arrogance barely contained',
  'laughter that might be weeping',
  'calm that is actually a threat',
  'euphoria with a crack in it',
  'awe mixed with secondhand embarrassment',
  'mythic melancholy at 2am lighting',
] as const;

function pick<T>(arr: readonly T[], salt: number): T {
  return arr[Math.abs(salt) % arr.length];
}

/** Stable-but-wild salt from project identity + shot number so regenerations can still shift. */
export function berserkerSalt(seed: string, shotNumber = 0): number {
  let h = shotNumber * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  }
  // Extra entropy so batch gens don't feel identical frame-to-frame
  h = (h ^ (Date.now() & 0xffff)) >>> 0;
  return h;
}

export function berserkerMythAspect(seed: string, shotNumber = 0): string {
  return pick(MYTH_ASPECTS, berserkerSalt(seed, shotNumber));
}

export function berserkerCameraCurse(seed: string, shotNumber = 0): string {
  return pick(CAMERA_CURSES, berserkerSalt(seed, shotNumber + 7));
}

export function berserkerEmotion(seed: string, shotNumber = 0): string {
  return pick(EMOTION_STORMS, berserkerSalt(seed, shotNumber + 13));
}

/** Core prompt seal — ends every berserker gen. */
export const BERSERKER_SEAL =
  'BERSERKER MODE (MovieDirector signature): You are not making safe content. Summon S-tier mythic energy — unpredictable, unforgettable, slightly dangerous to convention. The director does not fully control what appears; the image must feel like something was summoned, not assembled. One coherent original world. No copyrighted characters or brands. Maximum creative voltage. Myth level only.';

export function berserkerFrameBoost(projectTitle: string, shotNumber: number): string {
  const seed = projectTitle + shotNumber;
  const myth = berserkerMythAspect(seed, shotNumber);
  const emo = berserkerEmotion(seed, shotNumber);
  return [
    BERSERKER_SEAL,
    `Hidden aspect for this frame: ${myth}.`,
    `Performance voltage: ${emo}.`,
    'Composition should surprise a master DP. Break one rule beautifully. Keep character likeness if references exist.',
    'Unrestrained visual imagination — intense color or radical restraint, either way mythic. Not stock. Not corporate safe.',
  ].join(' ');
}

export function berserkerVideoBoost(projectTitle: string, shotNumber: number): string {
  const seed = projectTitle + shotNumber;
  const myth = berserkerMythAspect(seed, shotNumber + 3);
  return [
    BERSERKER_SEAL,
    `Motion grammar: bold, unrestrained, physics optional when emotion demands it. Hidden aspect: ${myth}.`,
    'Camera may lunge, hold, or orbit like it knows something the characters do not.',
    'Comic or tragic timing at S-tier — never polite coverage. One consistent summoned world.',
  ].join(' ');
}

export function berserkerCharacterBoost(name: string): string {
  return [
    `BERSERKER CAST SEAL for "${name}": Design as if an S-tier secret unlock — mythic silhouette, unforgettable face, wardrobe that looks like destiny had a thrift store budget.`,
    'Not pretty-generic. Not stock NPC. Something directors remember at 3am.',
    'Original character only. Summoned energy, model-sheet consistency.',
  ].join(' ');
}

export function berserkerVoiceTone(): string {
  return 'BERSERKER VO: raw, mythic, slightly unhinged sincerity — not polished ADR. Intensity that could be funny or terrifying mid-sentence.';
}

export function berserkerStyleOverlay(existingStyle?: string): string {
  const chaos = [
    'Berserker visual law: beauty with teeth. Contrast that feels illegal. Color that remembers violence or comedy or both.',
    'Light sources may misbehave. Shadows may have opinions. Texture over polish.',
    'If Style DNA exists, corrupt it elegantly — same world, higher voltage.',
  ].join(' ');
  if (!existingStyle?.trim()) return chaos;
  return `${existingStyle.trim()} | ${chaos}`;
}

type ShotDraft = Omit<Shot, 'id'>;

function shot(
  number: number,
  description: string,
  camera: string,
  duration: number,
  extra?: Partial<ShotDraft>
): ShotDraft {
  return { number, description, camera, duration, ...extra };
}

/** Full berserker treatment packs — different DNA than safe mode. */
export function berserkerTreatment(
  type: ProjectType,
  title: string,
  logline: string
): { synopsis: string; shots: ShotDraft[] } {
  const seal = `BERSERKER MODE engaged on "${title}". The audience should feel something was summoned.`;

  const packs: Record<ProjectType, { synopsis: string; shots: ShotDraft[] }> = {
    sitcom: {
      synopsis: `${title} — ${logline}\n\n${seal}\n\nNot a tidy 22. A myth wearing a sitcom skin. Cold open that feels like a prophecy misfiring. A/B plots that collide into cosmology. The tag is either the funniest or the scariest second of the episode. No creative seatbelts.`,
      shots: [
        shot(1, 'COLD OPEN / THE SUMMONING — Reality hiccups. A face that knows too much. Smash into chaos that still has joke architecture.', berserkerCameraCurse(title, 1), 16, { emotion: berserkerEmotion(title, 1), styleNotes: 'Berserker cold open — S-tier voltage' }),
        shot(2, 'TITLE CARD AS OMEN — Typography that feels cursed or divine. Ensemble tableau like a pantheon in office chairs.', 'Wide, locked, slightly wrong', 7),
        shot(3, 'THE TERRIBLE IDEA — Lead commits. The room reacts like a Greek chorus on lunch break.', berserkerCameraCurse(title, 3), 22, { emotion: 'divine confidence' }),
        shot(4, 'B-PLOT IN ANOTHER DIMENSION — Side character disaster that rhymes with myth for no good reason.', 'Over-shoulder then impossible insert', 18),
        shot(5, 'ESCALATION STORM — Cross-cut until causality begs. Comedy physics optional.', 'Rapid intercut / crash zooms', 28),
        shot(6, 'THE FORBIDDEN HEART — Two people almost tell the truth. Silence is the punchline.', 'Intimate static, one practical dying', 14, { emotion: 'awe + embarrassment' }),
        shot(7, 'CLIMAX CONVERGENCE — All plots slam. Someone becomes briefly mythic. Then the rent is still due.', berserkerCameraCurse(title, 7), 26),
        shot(8, 'TAG / AFTERMATH — One last impossible joke or a button that rewrites the pilot.', 'Single, tight, held too long', 12),
      ],
    },
    film: {
      synopsis: `${title}\n\n${logline}\n\n${seal}\n\nA short film as ritual. Every frame must feel inevitable and slightly illegal. Turn at 65% should feel like a door opening under the ocean.`,
      shots: [
        shot(1, 'OPENING IMAGE AS PROPHECY — Theme in pure metaphor. Something wrong and beautiful.', berserkerCameraCurse(title, 1), 12, { emotion: berserkerEmotion(title, 1) }),
        shot(2, 'WORLD THAT BREATHES — Character exists; the location has a pulse.', 'Handheld, observant, animal', 22),
        shot(3, 'THE CRACK — Subtle first, then undeniable. A rule of the world breaks.', 'Slow dolly into the wound', 16),
        shot(4, 'THE IRREVERSIBLE — Choice lands. Camera does not flinch.', 'Locked. Sudden push. No mercy.', 10),
        shot(5, 'CONSEQUENCES AS WEATHER — World reacts with mythic weather or social collapse or both.', 'Long lens, distant god view', 30),
        shot(6, 'FINAL IMAGE — Character rewritten. Hold until the audience feels summoned too.', berserkerCameraCurse(title, 6), 20, { emotion: 'aftermath of a legend' }),
      ],
    },
    commercial: {
      synopsis: `${title} — ${logline}\n\n${seal}\n\nBrand film as possession. Hook that stops the scroll by scaring desire awake. Product arrives like an artifact, not a SKU.`,
      shots: [
        shot(1, 'HOOK / THE HAUNT — Human truth so sharp it hurts. No logo yet.', berserkerCameraCurse(title, 1), 5, { emotion: 'recognition as violence' }),
        shot(2, 'DESIRE STORM — Stakes, bodies, need. Real and slightly mythic.', 'Naturalistic then impossible detail', 9),
        shot(3, 'ARTIFACT REVEAL — Brand/object as elegant solution with occult confidence.', 'Hero reveal, light misbehaves', 6),
        shot(4, 'AFTERSTATE — Life is better and weirder. Emotional payoff with teeth.', 'Soft light, human, uncanny', 7),
        shot(5, 'STING — Logo/line like a seal on a spell. Clean and dangerous.', 'Centered lockup, hold', 4),
      ],
    },
    anime: {
      synopsis: `${title}\n${logline}\n\n${seal}\n\nAnime short as god-tier key art in motion. Color is doctrine. One transformation that feels permanent.`,
      shots: [
        shot(1, 'ESTABLISHING MYTH CITY — Neon temple alley sky that should not exist.', 'Epic wide, slight crane, sacred trash', 11),
        shot(2, 'HERO SILHOUETTE — Wind, cloth, destiny. Low angle that worships without bootlicking.', 'Low heroic, lens flare as omen', 8),
        shot(3, 'THE SPARK — Eyes. Power. A decision older than dialogue.', 'Extreme close, speed-line whisper', 5, { emotion: 'S-tier resolve' }),
        shot(4, 'CLASH / TRANSFORMATION — Pure visual poetry. Impact frames as gospel.', 'Dynamic, speed lines, reality tears', 18),
        shot(5, 'AFTERMATH STILLNESS — Petal, smoke, or silence. The world remembers.', 'Static, painterly, held', 14),
      ],
    },
    'brand-fusion': {
      synopsis: `${title}\n\n${logline}\n\n${seal}\n\nTwo worlds collide until a third religion is born. Fusion is not compromise — it is alchemy.`,
      shots: [
        shot(1, 'COLLISION FRAME — Two visual languages in one shot, fighting and flirting.', 'Split composition / deep focus war', 10),
        shot(2, 'EMISSARIES MEET — Chemistry as threat. Friction as plot.', 'Two-shot, opposing myth energies', 12),
        shot(3, 'THE FUSION RITUAL — Middle ground that looks impossible until it does not.', 'Symmetrical hero, sacred geometry', 9),
        shot(4, 'CULTURAL PAYOFF — Combined world feels inevitable. Product/story as seal.', 'Slow push into the new law', 11),
        shot(5, 'DOUBLE TITLE SEAL — Both identities, one new pantheon. Clean lockup with residual chaos.', 'Centered lockup', 5),
      ],
    },
  };

  return packs[type];
}

/** Safe-mode treatments (original clean DNA). */
export function standardTreatment(
  type: ProjectType,
  title: string,
  logline: string
): { synopsis: string; shots: ShotDraft[] } {
  const packs: Record<ProjectType, { synopsis: string; shots: ShotDraft[] }> = {
    sitcom: {
      synopsis: `${title} — ${logline}\n\nA tight 22-minute episode. Cold open gag, A-plot/B-plot collision, tag. Emotional turn at minute 14. Killer button at the end.`,
      shots: [
        shot(1, 'COLD OPEN — The inciting ridiculousness. Tight on character face, smash cut into chaos.', 'Close-up → Whip pan', 18),
        shot(2, 'TITLE CARD + THEME STING. The ensemble in absurd tableau.', 'Wide, locked off', 6),
        shot(3, 'A-plot launch. The main character gets the terrible idea.', 'Medium, tracking push-in', 24),
        shot(4, "B-plot parallel. Side character's minor disaster.", 'Over shoulder two-shot', 16),
        shot(5, 'Cross-cut escalation. Everything gets worse in both plots at once.', 'Rapid intercut', 32),
        shot(6, 'Heart moment. Two characters actually talk like humans for 8 seconds.', 'Intimate static', 14),
        shot(7, 'Climax convergence. All threads slam together in the living room / office / bar.', 'Low angle, circling', 28),
        shot(8, 'TAG. One last perfect dumb joke or surprisingly sweet button.', 'Single, tight', 11),
      ],
    },
    film: {
      synopsis: `${title}\n\n${logline}\n\nA self-contained emotional machine. 6-12 minutes. No wasted frames. A decisive turn at 65%.`,
      shots: [
        shot(1, 'Opening image that contains the entire theme in metaphor.', 'Static wide or macro detail', 14),
        shot(2, 'World and character established with minimal dialogue.', 'Handheld, observant', 26),
        shot(3, 'The crack appears. Something is off. Subtle.', 'Slow dolly', 19),
        shot(4, 'The choice or event that cannot be undone.', 'Locked. Sudden push.', 9),
        shot(5, 'Consequences play out. The world reacts.', 'Long lens, distant', 38),
        shot(6, 'Climactic image. The character changed forever, shown not said.', 'Final wide or extreme close', 22),
      ],
    },
    commercial: {
      synopsis: `${title} — ${logline}\n\n30-45 second brand film. One crystal clear idea. Emotional truth + product truth in the same breath. Ends on a sting.`,
      shots: [
        shot(1, 'Hook frame. A human truth or striking visual that stops scroll.', 'Bold close or impossible wide', 4),
        shot(2, 'The tension or desire. Real people, real stakes.', 'Naturalistic', 9),
        shot(3, 'The brand arrives as the elegant solution, never the hero.', 'Elegant product reveal', 6),
        shot(4, 'Emotional payoff. The after state feels better than before.', 'Soft light, human', 7),
        shot(5, 'Logo + final line. Clean. Confident. Unforgettable.', 'Centered lockup', 4),
      ],
    },
    anime: {
      synopsis: `${title}\n${logline}\n\nStylized short. Exaggerated expressions. One breathtaking action or quiet transcendent moment. Strong color language.`,
      shots: [
        shot(1, 'Iconic establishing: neon city, floating temple, or rain-soaked alley.', 'Epic wide, slight crane', 12),
        shot(2, 'Hero silhouette or dramatic profile. Wind, hair, cape.', 'Low heroic angle', 8),
        shot(3, 'The spark. Eyes narrow. Power builds.', 'Extreme close on eyes', 5),
        shot(4, 'The clash or transformation. Pure visual poetry.', 'Dynamic, speed lines', 18),
        shot(5, 'Aftermath. Stillness. A single petal falls or a cigarette is lit.', 'Static, painterly', 14),
      ],
    },
    'brand-fusion': {
      synopsis: `${title}\n\n${logline}\n\nTwo worlds. One story. The tension between them is the product. Funny, moving, or both. Never forced.`,
      shots: [
        shot(1, 'Two visual languages collide in the same frame.', 'Split composition or deep focus', 11),
        shot(2, 'Representatives of each brand meet. Friction + chemistry.', 'Two-shot, opposing eyelines', 13),
        shot(3, 'The absurd beautiful middle ground. The fusion moment.', 'Symmetrical hero frame', 9),
        shot(4, 'Cultural payoff. The combined thing feels inevitable.', 'Slow push to product', 12),
        shot(5, 'Final title card. Both logos. One new world.', 'Clean lockup', 5),
      ],
    },
  };
  return packs[type];
}

export const BERSERKER_UI = {
  label: 'BERSERKER',
  fullLabel: 'BERSERKER MODE',
  tagline: 'MovieDirector signature. S-tier myth unlock. You do not fully control what arrives.',
  warning: 'Safe taste is offline. Outcomes are unpredictable by design.',
  engagedToast: 'BERSERKER engaged. Something was summoned.',
  disengagedToast: 'Berserker sealed. Creative guardrails restored.',
};
