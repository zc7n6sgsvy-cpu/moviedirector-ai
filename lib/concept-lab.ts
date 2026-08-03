/**
 * Concept Laboratory — pre-production brain of MovieDirector.
 *
 * Directors don't prompt randomly. They run a lab:
 * World → Script → Character direction → Continuity → then Generate.
 */

import type { Character, Project, Shot } from '@/lib/types';

export type LabStationId =
  | 'auto'
  | 'world'
  | 'script'
  | 'narrative'
  | 'prompts'
  | 'cast-direction'
  | 'continuity'
  | 'economy'
  | 'readiness';

export interface WorldBible {
  setting?: string;
  timePeriod?: string;
  tone?: string;
  themes?: string;
  audience?: string;
  visualLaws?: string;
  whatNever?: string;
  northStar?: string;
}

export interface ContinuityNotes {
  wardrobeRules?: string;
  locations?: string;
  props?: string;
  timeline?: string;
  doNotBreak?: string;
}

export const LAB_STATIONS: {
  id: LabStationId;
  label: string;
  short: string;
  purpose: string;
}[] = [
  {
    id: 'auto',
    label: 'Auto Mode',
    short: 'Auto',
    purpose: 'Minimal input: title + logline → auto treatment & shot list. Skip the deep lab when you want speed.',
  },
  {
    id: 'world',
    label: 'World Bible',
    short: 'World',
    purpose: 'Setting, tone, laws of the universe, audience, visual doctrine.',
  },
  {
    id: 'script',
    label: 'Script Control',
    short: 'Script',
    purpose: 'Master script / teleplay. Dialogue and scene order that drive shots.',
  },
  {
    id: 'narrative',
    label: 'Narrative Engine',
    short: 'Story',
    purpose:
      'Showrunner + plot-twist specialist: elevate hooks, cliffhangers, stakes, and earned twists by genre.',
  },
  {
    id: 'prompts',
    label: 'Prompt Control',
    short: 'Prompts',
    purpose: 'Edit the master Grok prompt, suffix, negatives — full premium control before spend.',
  },
  {
    id: 'cast-direction',
    label: 'Character Direction',
    short: 'Direction',
    purpose: 'Objectives, arcs, how each character behaves and speaks.',
  },
  {
    id: 'continuity',
    label: 'Continuity Desk',
    short: 'Continuity',
    purpose: 'Wardrobe, locations, props, timeline — what must never break.',
  },
  {
    id: 'economy',
    label: 'Cost & Drafts',
    short: 'Costs',
    purpose: 'Why this is not free like X Imagine — and how drafts + retakes keep testing sane.',
  },
  {
    id: 'readiness',
    label: 'Lab Readiness',
    short: 'Go',
    purpose: 'Checklist before you burn credits on generation.',
  },
];

export function emptyWorldBible(): WorldBible {
  return {
    setting: '',
    timePeriod: '',
    tone: '',
    themes: '',
    audience: '',
    visualLaws: '',
    whatNever: '',
    northStar: '',
  };
}

export function emptyContinuity(): ContinuityNotes {
  return {
    wardrobeRules: '',
    locations: '',
    props: '',
    timeline: '',
    doNotBreak: '',
  };
}

/** Merge lab fields into concept string for backward-compatible prompts. */
export function composeConceptFromLab(
  concept: string | undefined,
  world: WorldBible | undefined,
  continuity: ContinuityNotes | undefined
): string {
  const parts: string[] = [];
  if (concept?.trim()) parts.push(concept.trim());
  if (world?.northStar?.trim()) parts.push(`North star: ${world.northStar.trim()}`);
  if (world?.setting?.trim()) parts.push(`Setting: ${world.setting.trim()}`);
  if (world?.timePeriod?.trim()) parts.push(`Period: ${world.timePeriod.trim()}`);
  if (world?.tone?.trim()) parts.push(`Tone: ${world.tone.trim()}`);
  if (world?.themes?.trim()) parts.push(`Themes: ${world.themes.trim()}`);
  if (world?.audience?.trim()) parts.push(`Audience: ${world.audience.trim()}`);
  if (world?.visualLaws?.trim()) parts.push(`Visual laws: ${world.visualLaws.trim()}`);
  if (world?.whatNever?.trim()) parts.push(`Never: ${world.whatNever.trim()}`);
  if (continuity?.locations?.trim()) parts.push(`Locations: ${continuity.locations.trim()}`);
  if (continuity?.wardrobeRules?.trim()) parts.push(`Wardrobe continuity: ${continuity.wardrobeRules.trim()}`);
  if (continuity?.props?.trim()) parts.push(`Props: ${continuity.props.trim()}`);
  if (continuity?.timeline?.trim()) parts.push(`Timeline: ${continuity.timeline.trim()}`);
  if (continuity?.doNotBreak?.trim()) parts.push(`Do not break: ${continuity.doNotBreak.trim()}`);
  return parts.join('. ');
}

export function characterDirectionBlock(c: Character): string {
  const bits = [
    c.name && `${c.name} (${c.role || 'role TBD'})`,
    c.objective && `Objective: ${c.objective}`,
    c.arc && `Arc: ${c.arc}`,
    c.directionNotes && `Direction: ${c.directionNotes}`,
    c.personality && `Personality: ${c.personality}`,
    c.catchphrase && `Speech fingerprint: "${c.catchphrase}"`,
  ].filter(Boolean);
  return bits.join('. ');
}

export type LabCheck = {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
};

export function labReadiness(project: Project): { score: number; checks: LabCheck[] } {
  const world = project.worldBible;
  const script = project.script?.trim() || '';
  const cast = project.characters || [];
  const shots = project.shots || [];
  const withDialogue = shots.filter((s) => s.dialogue?.trim()).length;
  const withDirection = cast.filter(
    (c) => c.objective?.trim() || c.directionNotes?.trim() || c.arc?.trim()
  ).length;
  const withRefs = cast.filter((c) => c.referenceImageUrl).length;

  const checks: LabCheck[] = [
    {
      id: 'logline',
      label: 'Logline locked',
      ok: !!project.logline?.trim() && project.logline.trim().length > 12,
      hint: 'One sharp sentence for the whole film.',
    },
    {
      id: 'world',
      label: 'World bible started',
      ok: !!(world?.setting?.trim() || world?.tone?.trim() || project.concept?.trim()),
      hint: 'Setting + tone at minimum.',
    },
    {
      id: 'script',
      label: 'Script has substance',
      ok: script.length >= 80,
      hint: 'Write scene dialogue / action in Script Control.',
    },
    {
      id: 'cast',
      label: 'At least one character',
      ok: cast.length >= 1,
      hint: 'Add cast in Ensemble, then direct them here.',
    },
    {
      id: 'direction',
      label: 'Character direction notes',
      ok: withDirection >= 1 || cast.length === 0,
      hint: 'Objective / arc / direction on each key character.',
    },
    {
      id: 'refs',
      label: 'Visual refs (optional but powerful)',
      ok: withRefs >= 1 || cast.length === 0,
      hint: 'Generate reference portraits for consistency.',
    },
    {
      id: 'shots',
      label: 'Shot list exists',
      ok: shots.length >= 3,
      hint: 'Regenerate treatment or build storyboard.',
    },
    {
      id: 'dialogue',
      label: 'Dialogue on shots',
      ok: withDialogue >= 1 || script.length < 80,
      hint: 'Push script lines onto shots or write per-shot dialogue.',
    },
    {
      id: 'style',
      label: 'Style / visual law',
      ok: !!(project.style?.description?.trim() || world?.visualLaws?.trim()),
      hint: 'Style DNA or visual laws so frames match.',
    },
    {
      id: 'prompts',
      label: 'Master prompt control',
      ok: !!(
        project.generationSettings?.masterPrompt?.trim() ||
        project.generationSettings?.negativePrompt?.trim() ||
        project.style?.description?.trim()
      ),
      hint: 'Set master prompt / negatives in Prompts station (free).',
    },
  ];

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks };
}

/**
 * Parse simple script lines into dialogue for shots.
 * Supports:
 *   CHARACTER
 *   Dialogue line
 * and
 *   CHARACTER: Dialogue
 * and scene headers SCENE / INT. / EXT.
 */
export function parseScriptBeats(script: string): { speaker?: string; line: string; isScene?: boolean }[] {
  const lines = script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const beats: { speaker?: string; line: string; isScene?: boolean }[] = [];
  let pendingSpeaker: string | undefined;

  for (const line of lines) {
    if (/^(INT\.|EXT\.|SCENE|COLD OPEN|TITLE|FADE)/i.test(line) || line === line.toUpperCase() && line.length < 48 && !line.includes(':')) {
      if (/^(INT\.|EXT\.|SCENE|COLD OPEN|TITLE|FADE)/i.test(line)) {
        beats.push({ line, isScene: true });
        pendingSpeaker = undefined;
        continue;
      }
      // ALL CAPS short line → speaker
      if (line === line.toUpperCase() && /^[A-Z0-9 #.']+$/.test(line) && line.length <= 40) {
        pendingSpeaker = line.replace(/\s*\(.*?\)\s*/g, '').trim();
        continue;
      }
    }
    const colon = line.match(/^([A-Za-z][A-Za-z0-9_ .']{0,32}):\s*(.+)$/);
    if (colon) {
      beats.push({ speaker: colon[1].trim(), line: colon[2].trim() });
      pendingSpeaker = undefined;
      continue;
    }
    if (pendingSpeaker) {
      beats.push({ speaker: pendingSpeaker, line });
      pendingSpeaker = undefined;
      continue;
    }
    beats.push({ line });
  }
  return beats;
}

/** Apply dialogue beats onto shots in order (skips pure scene headers). */
export function applyScriptToShots(shots: Shot[], script: string): Shot[] {
  const dialogueBeats = parseScriptBeats(script).filter((b) => !b.isScene && b.line);
  if (!dialogueBeats.length) return shots;

  return shots.map((shot, i) => {
    const beat = dialogueBeats[i];
    if (!beat) return shot;
    const dialogue = beat.speaker ? `${beat.speaker}: ${beat.line}` : beat.line;
    return {
      ...shot,
      dialogue,
      // Keep visual description; enrich with performance cue
      actingCues: shot.actingCues || (beat.speaker ? `Deliver as ${beat.speaker}` : shot.actingCues),
    };
  });
}

export function applyCharacterDirectionToPrompt(project: Project): string {
  const cast = project.characters || [];
  if (!cast.length) return '';
  return cast.map(characterDirectionBlock).filter(Boolean).join(' | ');
}
