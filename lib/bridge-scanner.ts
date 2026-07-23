/**
 * Bridge Scanner — best-practice continuity pipeline.
 *
 * PLAYBOOK (how bridges should work):
 * 1. SCAN  — read both shots: frames and/or clips, dialogue/script, cast, set
 * 2. BRIEF — structured continuity document (free, no gen spend)
 * 3. LOCK  — inject cast + environment + brief into a bridge shot
 * 4. STILL — multi-image EDIT from frame A (+ B), never pure text invent
 * 5. MOTION — image-to-video from that still, same locks
 * 6. CUT   — assemble uses bridge clip; drop still-only plates
 *
 * Cost: scan is free. Still + motion are the only credit burns.
 * Accuracy: model never invents a third world because refs + brief bind it.
 */

import type { Character, EnvironmentLocation, Project, Shot } from '@/lib/types';
import { characterMemoryBlock } from '@/lib/character-memory';
import {
  preferredBridgeCharacterIds,
  preferredBridgeEnvironmentId,
  bridgeEditImageUrls,
  bridgeFrameReady,
  isTransitionShot,
} from '@/lib/transitions';

export type BridgeMediaKind = 'none' | 'frame' | 'clip' | 'both';

export interface ShotScanSlice {
  shotId: string;
  number: number;
  description: string;
  dialogue?: string;
  camera?: string;
  emotion?: string;
  media: BridgeMediaKind;
  imageUrl?: string;
  videoUrl?: string;
  characterIds: string[];
  characterNames: string[];
  environmentId?: string;
  environmentName?: string;
}

export interface BridgeScanBrief {
  scannedAt: string;
  from: ShotScanSlice;
  to: ShotScanSlice;
  /** Cast that may appear — intersection preferred */
  castIds: string[];
  castNames: string[];
  castModelSheets: string[];
  /** Locked set for the bridge */
  environmentId?: string;
  environmentName?: string;
  environmentSheet?: string;
  /** Script/dialogue continuity */
  scriptLines: string[];
  /** Visual assets used as edit sources (URLs) */
  referenceImageUrls: string[];
  /** Human-readable continuity brief */
  continuityBrief: string;
  /** Ready for image-edit gen? */
  canGenerateStill: boolean;
  stillBlocker?: string;
  /** Suggested bridge duration */
  durationSec: number;
  /** Motion intent one-liner */
  motionIntent: string;
  /** Non-fatal scanner notes (auto-bound cast/set, missing B frame, etc.) */
  warnings?: string[];
}

function mediaKind(s: Shot): BridgeMediaKind {
  const hasI = !!s.imageUrl;
  const hasV = !!s.videoUrl;
  if (hasI && hasV) return 'both';
  if (hasV) return 'clip';
  if (hasI) return 'frame';
  return 'none';
}

function sliceShot(project: Project, s: Shot): ShotScanSlice {
  const chars = (project.characters || []).filter((c) => (s.characterIds || []).includes(c.id));
  const envId = s.environmentId || project.defaultEnvironmentId;
  const env = (project.environments || []).find((e) => e.id === envId);
  return {
    shotId: s.id,
    number: s.number,
    description: s.description || '',
    dialogue: s.dialogue || s.voiceoverScript,
    camera: s.cameraDetailed || s.camera,
    emotion: s.emotion,
    media: mediaKind(s),
    imageUrl: s.imageUrl,
    videoUrl: s.videoUrl,
    characterIds: s.characterIds || [],
    characterNames: chars.map((c) => c.name),
    environmentId: env?.id,
    environmentName: env?.name,
  };
}

function modelSheet(c: Character): string {
  if (c.consistencyLock?.modelSheet) return c.consistencyLock.modelSheet;
  return characterMemoryBlock(c);
}

function envSheet(env?: EnvironmentLocation): string | undefined {
  if (!env) return undefined;
  return (
    env.consistencyLock?.modelSheet ||
    [env.name, env.placeType, env.description, env.lighting, env.signatureProps].filter(Boolean).join(' — ')
  );
}

/**
 * Free structural scan — always run before generating a bridge.
 * Auto-binds project cast + default/first set when shots untagged.
 */
export function scanBridgePair(project: Project, from: Shot, to: Shot): BridgeScanBrief {
  const fromS = sliceShot(project, from);
  const toS = sliceShot(project, to);
  const warnings: string[] = [];

  let castIds = preferredBridgeCharacterIds(from, to);
  if (!castIds.length && (project.characters || []).length > 0) {
    castIds = (project.characters || []).map((c) => c.id);
    warnings.push(
      'Neither shot had cast tags — auto-bound full project cast. Tag cast on shots 1 & 2 for tighter control.'
    );
  }
  const cast = (project.characters || []).filter((c) => castIds.includes(c.id));

  let envId = preferredBridgeEnvironmentId(from, to, project.defaultEnvironmentId);
  if (!envId && (project.environments || []).length > 0) {
    envId = project.environments![0].id;
    warnings.push(
      `No set on shots — auto-bound “${project.environments![0].name}”. Assign SETS on each shot for series reuse.`
    );
  }
  const env = (project.environments || []).find((e) => e.id === envId);

  const scriptLines: string[] = [];
  if (from.dialogue?.trim()) scriptLines.push(`A: ${from.dialogue.trim()}`);
  if (to.dialogue?.trim()) scriptLines.push(`B: ${to.dialogue.trim()}`);
  if (from.voiceoverScript?.trim()) scriptLines.push(`A VO: ${from.voiceoverScript.trim()}`);
  if (to.voiceoverScript?.trim()) scriptLines.push(`B VO: ${to.voiceoverScript.trim()}`);
  if (project.script?.trim()) {
    const snippet = project.script.trim().slice(0, 400);
    scriptLines.push(`Master script context: ${snippet}${project.script.length > 400 ? '…' : ''}`);
  }

  // Neighbor frames first (required for identity), then cast/set refs
  const frameRefs = [from.imageUrl, to.imageUrl].filter(
    (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)
  );
  const extra = bridgeEditImageUrls(
    project,
    { characterIds: castIds, environmentId: envId } as Shot,
    from,
    to
  ).filter((u) => !frameRefs.includes(u));
  const referenceImageUrls = [...frameRefs, ...extra].slice(0, 3);

  let canGenerateStill = frameRefs.length >= 1;
  let stillBlocker: string | undefined;
  if (frameRefs.length === 0) {
    canGenerateStill = false;
    stillBlocker =
      'Generate frames on BOTH neighboring shots first. Bridge is an IMAGE EDIT of those frames — never a new scene from text.';
  } else if (frameRefs.length < 2) {
    warnings.push(
      'Only one neighbor has a frame. Generate the other shot’s frame for best cast/set match.'
    );
  }

  const styleSafe = (project.style?.description || '')
    .replace(/berserker|mythic|summon|unchained/gi, '')
    .trim();

  const continuityBrief = [
    `BRIDGE SCAN — "${project.title}" (CONTINUITY ONLY — not berserker invent mode)`,
    `FROM shot ${from.number} [${fromS.media}]: ${fromS.description.slice(0, 220)}`,
    `TO shot ${to.number} [${toS.media}]: ${toS.description.slice(0, 220)}`,
    cast.length
      ? `CAST LOCK (ONLY these faces — exact likeness from refs + frames): ${cast.map((c) => c.name).join(', ')}. ${cast.map(modelSheet).join(' | ')}`
      : 'CAST: none — do not invent people.',
    env
      ? `SET LOCK (SAME place): ${env.name} (${env.placeType}). ${envSheet(env)}. ${env.consistencyLock?.doNotChange || 'Do not redesign architecture or furniture.'}`
      : 'SET: match walls, lighting, geography EXACTLY from reference frames A and B. No new location.',
    scriptLines.length ? `SCRIPT: ${scriptLines.join(' / ')}` : 'SCRIPT: no dialogue on these beats.',
    styleSafe ? `STYLE (match A/B grade): ${styleSafe}` : '',
    project.continuity?.doNotBreak ? `DO NOT BREAK: ${project.continuity.doNotBreak}` : '',
    project.continuity?.wardrobeRules ? `WARDROBE: ${project.continuity.wardrobeRules}` : '',
    `MOTION: exit shot ${from.number} → enter shot ${to.number}. Micro-action only.`,
    'ABSOLUTE FORBIDDEN: new characters, random extras, new buildings, costume redesign, cold open, myth/berserker cameos.',
    warnings.length ? `NOTES: ${warnings.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    scannedAt: new Date().toISOString(),
    from: fromS,
    to: toS,
    castIds,
    castNames: cast.map((c) => c.name),
    castModelSheets: cast.map(modelSheet),
    environmentId: env?.id,
    environmentName: env?.name,
    environmentSheet: envSheet(env),
    scriptLines,
    referenceImageUrls,
    continuityBrief,
    canGenerateStill,
    stillBlocker,
    durationSec: 4,
    motionIntent: `Midpoint continuity from shot ${from.number} into shot ${to.number} — same people, same place as the reference frames.`,
    warnings,
  };
}

/** Build gen prompt from a completed scan (frame or video). */
export function promptFromBridgeScan(brief: BridgeScanBrief, kind: 'frame' | 'video'): string {
  if (kind === 'frame') {
    return [
      'You are editing the PROVIDED reference image(s) into a continuity bridge still.',
      'Image 1 = SCENE A (outgoing frame from the film). Image 2 (if present) = SCENE B (incoming frame).',
      'Your output MUST look like a natural in-between frame of THIS sequence — same room, same people, same grade.',
      'Do NOT generate a new unrelated scene. Do NOT invent new faces or locations.',
      `Cast allowed: ${brief.castNames.join(', ') || 'only people already visible in the reference frames'}.`,
      brief.environmentName
        ? `Stay inside locked set: ${brief.environmentName}. ${brief.environmentSheet || ''}`
        : 'Stay inside the set visible in the reference frames.',
      brief.continuityBrief,
      'Keep identity of every person in the refs. Mild camera/pose change only.',
      'No text overlays. No copyrighted characters. No berserker myth figures.',
    ].join('\n');
  }
  return [
    'Animate the seed still as a short continuity bridge — same people, same place.',
    brief.continuityBrief,
    brief.motionIntent,
    'No new faces. No new locations. Smooth continuous motion. Native ambient audio.',
  ].join('\n');
}

/** Create / update a bridge Shot from a scan brief. */
export function shotFromBridgeScan(
  brief: BridgeScanBrief,
  opts?: { id?: string; number?: number }
): Shot {
  return {
    id: opts?.id || `tr-${Date.now().toString(36)}`,
    number: opts?.number || brief.from.number + 1,
    shotKind: 'transition',
    isTransition: true,
    bridgeFromShotId: brief.from.shotId,
    bridgeToShotId: brief.to.shotId,
    description: brief.motionIntent + ' ' + brief.from.description.slice(0, 80) + ' → ' + brief.to.description.slice(0, 80),
    camera: brief.from.camera || 'Match cut / motivated move',
    duration: brief.durationSec,
    emotion: brief.from.emotion || brief.to.emotion,
    actingCues: 'Micro-action continuity only',
    characterIds: brief.castIds,
    environmentId: brief.environmentId,
    styleNotes: 'Scanner-built bridge — use continuityBrief as law',
    // Bake full brief into locked prompts so gen always uses scan, not thin text
    lockedFramePrompt: promptFromBridgeScan(brief, 'frame'),
    lockedVideoPrompt: promptFromBridgeScan(brief, 'video'),
    framePromptOverride: promptFromBridgeScan(brief, 'frame'),
    videoPromptOverride: promptFromBridgeScan(brief, 'video'),
  };
}

/** Insert scanner bridge after fromIndex; replaces existing bridge between pair if present. */
export function insertScannedBridge(
  shots: Shot[],
  fromIndex: number,
  brief: BridgeScanBrief
): Shot[] {
  if (fromIndex < 0 || fromIndex >= shots.length - 1) return shots;
  const a = shots[fromIndex];
  const b = shots[fromIndex + 1];
  // Remove existing bridge between these two if any
  let list = shots.filter(
    (s) =>
      !(
        isTransitionShot(s) &&
        s.bridgeFromShotId === a.id &&
        s.bridgeToShotId === b.id
      )
  );
  // Re-find index after filter
  const idx = list.findIndex((s) => s.id === a.id);
  if (idx < 0) return shots;
  const bridge = shotFromBridgeScan(brief, { number: idx + 2 });
  const next = [...list.slice(0, idx + 1), bridge, ...list.slice(idx + 1)];
  return next.map((s, i) => ({ ...s, number: i + 1 }));
}

export function findShotPair(
  shots: Shot[],
  afterShotId: string
): { from: Shot; to: Shot; fromIndex: number } | null {
  const fromIndex = shots.findIndex((s) => s.id === afterShotId);
  if (fromIndex < 0 || fromIndex >= shots.length - 1) return null;
  let toIndex = fromIndex + 1;
  // Skip existing bridge to find next story shot
  while (toIndex < shots.length && isTransitionShot(shots[toIndex])) toIndex++;
  if (toIndex >= shots.length) return null;
  const from = shots[fromIndex];
  const to = shots[toIndex];
  if (isTransitionShot(from) || isTransitionShot(to)) return null;
  return { from, to, fromIndex };
}
