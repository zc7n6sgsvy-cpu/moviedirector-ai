/**
 * Consistency Packs — lock characters & environments so AI doesn't "wipe" them.
 *
 * Cost thesis: reusing locked homes/offices/cafés + model-sheet cast means
 * more gens are "same world, new interaction" — fewer failed identity rolls,
 * fewer full scene rebuilds, lower credit burn for series/sequels.
 */

import type { Character, Project, Shot } from '@/lib/types';

export type PackKind = 'character' | 'environment';

/** Visual lock sheet — the anti-wipe contract */
export interface ConsistencyLock {
  /** Human-readable model sheet summary (always injected) */
  modelSheet: string;
  /** Hard negatives: never change these */
  doNotChange: string;
  /** Optional multiple ref URLs (front, 3/4, full body) */
  referenceUrls: string[];
  /** When true, prompts treat this as sacred — no reinterpretation */
  locked: boolean;
  lockedAt?: string;
}

export interface CharacterPack {
  id: string;
  kind: 'character';
  version: 1;
  name: string;
  role?: string;
  medium?: string;
  description: string;
  lock: ConsistencyLock;
  /** Full character fields for re-injection */
  character: Partial<Character>;
  createdAt: string;
  tags?: string[];
}

export interface EnvironmentPack {
  id: string;
  kind: 'environment';
  version: 1;
  name: string;
  /** e.g. home, office, cafe, exterior */
  placeType: string;
  description: string;
  lock: ConsistencyLock;
  /** Geography / time of day defaults */
  lighting?: string;
  architecture?: string;
  signatureProps?: string;
  createdAt: string;
  tags?: string[];
}

export type ConsistencyPack = CharacterPack | EnvironmentPack;

const CHAR_PACKS_KEY = 'moviedirector_character_packs';
const ENV_PACKS_KEY = 'moviedirector_environment_packs';

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function loadCharacterPacks(): CharacterPack[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CHAR_PACKS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCharacterPacks(packs: CharacterPack[]) {
  localStorage.setItem(CHAR_PACKS_KEY, JSON.stringify(packs.slice(0, 100)));
}

export function loadEnvironmentPacks(): EnvironmentPack[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ENV_PACKS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveEnvironmentPacks(packs: EnvironmentPack[]) {
  localStorage.setItem(ENV_PACKS_KEY, JSON.stringify(packs.slice(0, 100)));
}

export function characterToPack(c: Character): CharacterPack {
  const modelSheet = [
    c.name,
    c.role && `(${c.role})`,
    c.medium && `medium:${c.medium}`,
    c.description,
    c.faceNotes && `face:${c.faceNotes}`,
    c.silhouette && `silhouette:${c.silhouette}`,
    c.wardrobe && `wardrobe:${c.wardrobe}`,
    c.palette && `palette:${c.palette}`,
    c.signatureProp && `prop:${c.signatureProp}`,
    c.memoryNotes && `memory:${c.memoryNotes}`,
  ]
    .filter(Boolean)
    .join(' — ');

  return {
    id: `cp-${c.id || uid()}`,
    kind: 'character',
    version: 1,
    name: c.name || 'Unnamed',
    role: c.role,
    medium: c.medium,
    description: c.description || '',
    lock: {
      modelSheet,
      doNotChange:
        c.faceNotes || c.wardrobe
          ? `Never alter: ${[c.faceNotes, c.wardrobe, c.silhouette, c.signatureProp].filter(Boolean).join('; ')}`
          : 'Never alter face, hair, body type, or signature wardrobe from the model sheet.',
      referenceUrls: c.referenceImageUrl ? [c.referenceImageUrl] : [],
      locked: true,
      lockedAt: new Date().toISOString(),
    },
    character: { ...c },
    createdAt: new Date().toISOString(),
    tags: c.tags,
  };
}

export function lockCharacter(c: Character): Character {
  const pack = characterToPack(c);
  return {
    ...c,
    consistencyLock: pack.lock,
    packId: pack.id,
  };
}

export function packToCharacter(pack: CharacterPack, newId?: string): Character {
  const base = pack.character || {};
  return {
    id: newId || `char-${uid()}`,
    name: pack.name,
    role: pack.role || base.role || 'Character',
    description: pack.description || base.description || '',
    medium: (base.medium || pack.medium) as Character['medium'],
    silhouette: base.silhouette,
    palette: base.palette,
    wardrobe: base.wardrobe,
    faceNotes: base.faceNotes,
    signatureProp: base.signatureProp,
    personality: base.personality,
    catchphrase: base.catchphrase,
    objective: base.objective,
    arc: base.arc,
    directionNotes: base.directionNotes,
    relationships: base.relationships,
    memoryNotes: base.memoryNotes,
    memoryFacts: base.memoryFacts,
    referenceImageUrl: pack.lock.referenceUrls[0] || base.referenceImageUrl,
    consistencyLock: { ...pack.lock, locked: true },
    packId: pack.id,
    voiceAxes: base.voiceAxes,
    voiceVariants: base.voiceVariants,
    activeVoiceId: base.activeVoiceId,
    ttsVoiceId: base.ttsVoiceId,
    tags: pack.tags || base.tags,
  };
}

export function createEnvironmentPack(input: {
  name: string;
  placeType: string;
  description: string;
  lighting?: string;
  architecture?: string;
  signatureProps?: string;
  referenceImageUrl?: string;
  doNotChange?: string;
}): EnvironmentPack {
  const modelSheet = [
    input.name,
    input.placeType,
    input.description,
    input.architecture && `architecture:${input.architecture}`,
    input.lighting && `lighting:${input.lighting}`,
    input.signatureProps && `props:${input.signatureProps}`,
  ]
    .filter(Boolean)
    .join(' — ');

  return {
    id: `ep-${uid()}`,
    kind: 'environment',
    version: 1,
    name: input.name,
    placeType: input.placeType,
    description: input.description,
    lighting: input.lighting,
    architecture: input.architecture,
    signatureProps: input.signatureProps,
    lock: {
      modelSheet,
      doNotChange:
        input.doNotChange ||
        'Never redesign architecture, wall color, furniture layout, or signature props. Same place every time.',
      referenceUrls: input.referenceImageUrl ? [input.referenceImageUrl] : [],
      locked: true,
      lockedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

/** Prompt block that fights model "creativity" on locked identities */
export function characterConsistencyBlock(c: Character): string {
  const lock = c.consistencyLock;
  if (lock?.locked && lock.modelSheet) {
    return (
      `LOCKED CHARACTER "${c.name}" (do not redesign): ${lock.modelSheet}. ` +
      `${lock.doNotChange} ` +
      `Maintain exact likeness from reference. Same face, hair, body, wardrobe.`
    );
  }
  return `${c.name} (${c.role}): ${c.description}`;
}

export function environmentConsistencyBlock(env: {
  name: string;
  placeType?: string;
  description?: string;
  consistencyLock?: ConsistencyLock;
  lock?: ConsistencyLock;
}): string {
  if (!env) return '';
  const lock = env.consistencyLock || env.lock;
  return (
    `LOCKED ENVIRONMENT "${env.name}" (${env.placeType || 'set'}): ${lock?.modelSheet || env.description || ''}. ` +
    `${lock?.doNotChange || ''} Same set every shot — series continuity. Do not redesign architecture or furniture layout.`
  );
}

/** Multi-character interaction direction for a shot */
export function multiCharacterInteractionBlock(
  project: Project,
  shot: Shot
): string {
  const ids = shot.characterIds || [];
  if (ids.length < 2) return '';
  const cast = (project.characters || []).filter((c) => ids.includes(c.id));
  if (cast.length < 2) return '';

  const names = cast.map((c) => c.name).join(' and ');
  const interaction =
    shot.interactionNotes?.trim() ||
    'Clear eye contact, readable body language, shared screen space, physical proximity that sells the relationship.';

  return (
    `MULTI-CHARACTER INTERACTION: ${names} share this frame. ${interaction} ` +
    `Each face must match its locked model sheet. No merging faces. Blocking: ${shot.blocking || 'natural two-shot or over-shoulder'}.`
  );
}

/** Inject all locked envs + cast consistency into a prompt base */
export function injectConsistencyIntoPrompt(project: Project, shot: Shot, base: string): string {
  const parts = [base];

  const envId = shot.environmentId || project.defaultEnvironmentId;
  const env = (project.environments || []).find((e) => e.id === envId);
  if (env) {
    parts.push(environmentConsistencyBlock(env as EnvironmentPack));
  }

  const chars = (project.characters || []).filter((c) => shot.characterIds?.includes(c.id));
  if (chars.length) {
    parts.push(
      `CAST CONSISTENCY: ${chars.map(characterConsistencyBlock).join(' | ')}`
    );
  }

  const multi = multiCharacterInteractionBlock(project, shot);
  if (multi) parts.push(multi);

  return parts.join(' ');
}

/** Download pack as JSON file */
export function downloadPackJson(pack: ConsistencyPack, filename?: string) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${pack.kind}-${pack.name.replace(/\s+/g, '-').toLowerCase()}.mdpack.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parsePackJson(raw: string): ConsistencyPack | null {
  try {
    const p = JSON.parse(raw);
    if (p?.kind === 'character' || p?.kind === 'environment') return p as ConsistencyPack;
    return null;
  } catch {
    return null;
  }
}

/** Character-building agent: structured interview → draft character + lock sheet */
export type AgentStep = {
  id: string;
  question: string;
  placeholder: string;
  field: keyof AgentAnswers;
};

export type AgentAnswers = {
  name: string;
  role: string;
  ageVibe: string;
  face: string;
  wardrobe: string;
  personality: string;
  want: string;
  medium: string;
  world: string;
};

export const CHARACTER_AGENT_STEPS: AgentStep[] = [
  { id: 'name', question: 'What is their name?', placeholder: 'Alex Rivera', field: 'name' },
  { id: 'role', question: 'What is their role in the story?', placeholder: 'Cynical co-founder', field: 'role' },
  { id: 'age', question: 'Age / energy vibe?', placeholder: 'Early 30s, exhausted ambition', field: 'ageVibe' },
  { id: 'face', question: 'Face & hair (lock sheet)?', placeholder: 'Sharp jaw, messy dark hair, left brow scar', field: 'face' },
  { id: 'wardrobe', question: 'Signature wardrobe (never changes without a beat)?', placeholder: 'Black hoodie under blazer', field: 'wardrobe' },
  { id: 'personality', question: 'Personality in one line?', placeholder: 'Weaponized calm, status-anxious', field: 'personality' },
  { id: 'want', question: 'What do they want this episode?', placeholder: 'Close the round without losing the friend', field: 'want' },
  { id: 'medium', question: 'Visual medium?', placeholder: 'cartoon-2d / live-action / anime…', field: 'medium' },
  { id: 'world', question: 'Where do they live in this series?', placeholder: 'SF founder houses, fog, war-room energy', field: 'world' },
];

export function agentAnswersToCharacter(a: AgentAnswers, id?: string): Character {
  const description = [
    a.ageVibe,
    a.face,
    a.wardrobe,
    a.personality,
    a.world && `World: ${a.world}`,
  ]
    .filter(Boolean)
    .join('. ');

  const char: Character = {
    id: id || `char-${uid()}`,
    name: a.name.trim() || 'Unnamed',
    role: a.role.trim() || 'Role TBD',
    description,
    faceNotes: a.face,
    wardrobe: a.wardrobe,
    personality: a.personality,
    objective: a.want,
    medium: (a.medium || 'cartoon-2d') as Character['medium'],
    memoryNotes: `World base: ${a.world || 'series world'}`,
  };
  return lockCharacter(char);
}

export function agentAnswersToEnvironment(a: {
  name: string;
  placeType: string;
  description: string;
  lighting?: string;
  props?: string;
}): EnvironmentPack {
  return createEnvironmentPack({
    name: a.name,
    placeType: a.placeType,
    description: a.description,
    lighting: a.lighting,
    signatureProps: a.props,
  });
}
