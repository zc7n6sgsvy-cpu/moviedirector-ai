/**
 * Voice Lab — alternate vocal textures for characters.
 *
 * Rules:
 * - Never clone a real celebrity, existing cartoon character, or copyrighted voice.
 * - Produce *adjacent* originals from axes + archetype seeds.
 * - Output is a performance brief usable in dialogue prompts / future TTS.
 */

import type { VoiceAxes, VoiceVariant } from '@/lib/ensemble';
import { DEFAULT_VOICE_AXES } from '@/lib/ensemble';

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function axisWord(
  value: number,
  low: string,
  mid: string,
  high: string
): string {
  if (value < 34) return low;
  if (value < 67) return mid;
  return high;
}

export function describeAxes(axes: VoiceAxes): string {
  const pitch = axisWord(axes.pitch, 'low register', 'mid register', 'higher register');
  const energy = axisWord(axes.energy, 'restrained', 'balanced energy', 'high energy');
  const texture = axisWord(axes.texture, 'smooth', 'light grit', 'gravelly / textured');
  const pace = axisWord(axes.pace, 'measured / slow', 'conversational pace', 'rapid-fire');
  const attitude = axisWord(axes.attitude, 'warm / earnest', 'dry / neutral', 'smug / deadpan');
  return `${pitch}, ${energy}, ${texture}, ${pace}, ${attitude}`;
}

function variantName(i: number, axes: VoiceAxes): string {
  const tags: string[] = [];
  if (axes.attitude > 65) tags.push('Smug');
  else if (axes.attitude < 35) tags.push('Warm');
  if (axes.texture > 65) tags.push('Gravel');
  if (axes.pitch > 65) tags.push('Bright');
  if (axes.pitch < 35) tags.push('Deep');
  if (axes.pace > 65) tags.push('Rapid');
  if (axes.energy > 65) tags.push('Amped');
  if (axes.energy < 35) tags.push('Cool');
  const base = tags.slice(0, 2).join(' ') || 'Neutral';
  return `${base} Alt ${i + 1}`;
}

function makeVariant(id: string, axes: VoiceAxes, flavor: string): VoiceVariant {
  const desc = describeAxes(axes);
  return {
    id,
    name: variantName(Number(id.replace(/\D/g, '')) || 0, axes),
    axes,
    brief: `${flavor} Vocal color: ${desc}. Fully original performer — not an impression of any real person or existing character.`,
    promptSnippet: `Voice direction (original performer): ${desc}. ${flavor} Clear diction for comedy timing. Do not imitate any celebrity or copyrighted character voice.`,
  };
}

/**
 * Generate alternate voice versions around a seed (or defaults).
 * Slight axis jitter creates family of related-but-distinct voices.
 */
export function generateVoiceAlternates(
  seed: Partial<VoiceAxes> = {},
  count = 5
): VoiceVariant[] {
  const base: VoiceAxes = { ...DEFAULT_VOICE_AXES, ...seed };
  const flavors = [
    'Boardroom confidence with comic timing.',
    'Sidekick hype with earnest panic under the jokes.',
    'PA-system cool; announcements as punchlines.',
    'Soft-spoken menace that still lands laughs.',
    'Caffeinated intern energy, slightly cracked.',
    'Narrator sincerity applied to pure nonsense.',
  ];

  const deltas: Partial<VoiceAxes>[] = [
    {},
    { pitch: clamp(base.pitch + 18), attitude: clamp(base.attitude + 12) },
    { pitch: clamp(base.pitch - 20), texture: clamp(base.texture + 25), pace: clamp(base.pace - 10) },
    { energy: clamp(base.energy + 22), pace: clamp(base.pace + 20), attitude: clamp(base.attitude - 8) },
    { energy: clamp(base.energy - 18), texture: clamp(base.texture - 15), pitch: clamp(base.pitch + 8) },
    { attitude: clamp(base.attitude + 25), pace: clamp(base.pace - 15), texture: clamp(base.texture + 10) },
  ];

  return deltas.slice(0, count).map((d, i) => {
    const axes: VoiceAxes = {
      pitch: clamp(d.pitch ?? base.pitch),
      energy: clamp(d.energy ?? base.energy),
      texture: clamp(d.texture ?? base.texture),
      pace: clamp(d.pace ?? base.pace),
      attitude: clamp(d.attitude ?? base.attitude),
    };
    const v = makeVariant(`voice-${i + 1}`, axes, flavors[i % flavors.length]);
    v.name = variantName(i, axes);
    return v;
  });
}

/** Kinetic adult satire default voice seeds (original). */
export const SATIRE_VOICE_PRESETS: { id: string; label: string; axes: VoiceAxes; note: string }[] = [
  {
    id: 'lead-smug',
    label: 'Lead: smug visionary',
    axes: { pitch: 42, energy: 48, texture: 35, pace: 52, attitude: 82 },
    note: 'Iron confidence. Never admits fault. Original voice only.',
  },
  {
    id: 'sidekick-hype',
    label: 'Sidekick: hype engine',
    axes: { pitch: 62, energy: 78, texture: 30, pace: 72, attitude: 45 },
    note: 'Yes-and energy. Slightly cracked enthusiasm.',
  },
  {
    id: 'rival-ice',
    label: 'Rival: corporate ice',
    axes: { pitch: 38, energy: 40, texture: 55, pace: 45, attitude: 70 },
    note: 'Smile in the voice. Threats as compliments.',
  },
  {
    id: 'assistant-dry',
    label: 'Assistant: dry prophet',
    axes: { pitch: 55, energy: 28, texture: 25, pace: 48, attitude: 60 },
    note: 'Deadpan truth. The audience surrogate.',
  },
  {
    id: 'announcer',
    label: 'Trailer announcer (comedy)',
    axes: { pitch: 35, energy: 70, texture: 50, pace: 40, attitude: 50 },
    note: 'Epic sincerity for ridiculous plans.',
  },
];

export function activeVoiceSnippet(
  variants: VoiceVariant[] | undefined,
  activeId: string | undefined
): string | undefined {
  if (!variants?.length) return undefined;
  const v = variants.find((x) => x.id === activeId) || variants[0];
  return v.promptSnippet;
}
