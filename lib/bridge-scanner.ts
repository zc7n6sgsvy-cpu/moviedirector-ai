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
 * Does not call xAI; uses project truth + media URLs.
 */
export function scanBridgePair(project: Project, from: Shot, to: Shot): BridgeScanBrief {
  const fromS = sliceShot(project, from);
  const toS = sliceShot(project, to);
  const castIds = preferredBridgeCharacterIds(from, to);
  const cast = (project.characters || []).filter((c) => castIds.includes(c.id));
  const envId = preferredBridgeEnvironmentId(from, to, project.defaultEnvironmentId);
  const env = (project.environments || []).find((e) => e.id === envId);

  const scriptLines: string[] = [];
  if (from.dialogue?.trim()) scriptLines.push(`A: ${from.dialogue.trim()}`);
  if (to.dialogue?.trim()) scriptLines.push(`B: ${to.dialogue.trim()}`);
  if (from.voiceoverScript?.trim()) scriptLines.push(`A VO: ${from.voiceoverScript.trim()}`);
  if (to.voiceoverScript?.trim()) scriptLines.push(`B VO: ${to.voiceoverScript.trim()}`);
  // Pull nearby script context from master script if present
  if (project.script?.trim()) {
    const snippet = project.script.trim().slice(0, 400);
    scriptLines.push(`Master script context: ${snippet}${project.script.length > 400 ? '…' : ''}`);
  }

  const referenceImageUrls = bridgeEditImageUrls(project, { characterIds: castIds } as Shot, from, to);
  const ready = bridgeFrameReady(from, to);

  const continuityBrief = [
    `BRIDGE SCAN — "${project.title}"`,
    `FROM shot ${from.number} [${fromS.media}]: ${fromS.description.slice(0, 180)}`,
    `TO shot ${to.number} [${toS.media}]: ${toS.description.slice(0, 180)}`,
    cast.length
      ? `CAST (only): ${cast.map((c) => c.name).join(', ')}. ${cast.map(modelSheet).join(' | ')}`
      : 'CAST: none tagged — prefer empty environment connect; do not invent people.',
    env
      ? `SET (locked): ${env.name} (${env.placeType}). ${envSheet(env)}. ${env.consistencyLock?.doNotChange || ''}`
      : 'SET: inherit geography/lighting from reference frames A and B only.',
    scriptLines.length ? `SCRIPT: ${scriptLines.join(' / ')}` : 'SCRIPT: no dialogue on these beats.',
    project.style?.description ? `STYLE DNA: ${project.style.description}` : '',
    project.continuity?.doNotBreak ? `DO NOT BREAK: ${project.continuity.doNotBreak}` : '',
    `MOTION: exit energy of shot ${from.number} → entry of shot ${to.number}. Micro-action only.`,
    'FORBIDDEN: new characters, new locations, costume changes, cold-open energy, myth cameos.',
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
    canGenerateStill: ready.ok,
    stillBlocker: ready.reason,
    durationSec: 4,
    motionIntent: `Connect shot ${from.number} into shot ${to.number} in one continuous world.`,
  };
}

/** Build gen prompt from a completed scan (frame or video). */
export function promptFromBridgeScan(brief: BridgeScanBrief, kind: 'frame' | 'video'): string {
  if (kind === 'frame') {
    return [
      'CONTINUITY BRIDGE STILL — image edit of the provided reference frames.',
      'Image 1 = SCENE A (outgoing). Image 2 (if any) = SCENE B (incoming).',
      'Output = visual midpoint of A and B. Same world. Same people. Same set.',
      brief.continuityBrief,
      'Preserve every face and wardrobe visible in the references. Do not invent strangers.',
      'Mild pose/camera change only — connective tissue, not a new scene.',
      'No text overlays. No copyrighted characters.',
    ].join('\n');
  }
  return [
    'CONTINUITY BRIDGE CLIP — animate the seed still toward the next beat.',
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
