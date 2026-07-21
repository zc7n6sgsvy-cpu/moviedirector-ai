/**
 * Transition bridges — continuity tissue between story clips.
 *
 * Failure mode we fix: bridges inventing random cast / new scenes.
 * Rules:
 *  - ONLY characters already on neighboring shots (union, preferably intersection)
 *  - NO new characters, extras, or crowd heroes
 *  - Prefer image-to-video from shot A's last frame (or bridge still)
 *  - Berserker chaos is DISABLED on bridges — continuity beats myth
 *  - Same wardrobe, location geography, Style DNA
 */

import type { Character, Project, Shot } from '@/lib/types';
import { characterMemoryBlock } from '@/lib/character-memory';

export function isTransitionShot(shot: Shot): boolean {
  return shot.shotKind === 'transition' || !!shot.isTransition;
}

/** Characters that may appear on a bridge: union of neighbors, never empty invention. */
export function bridgeCharacterIds(from?: Shot, to?: Shot): string[] {
  const ids = new Set<string>([...(from?.characterIds || []), ...(to?.characterIds || [])]);
  return [...ids];
}

/** Prefer intersection when both shots share cast — strongest continuity. */
export function preferredBridgeCharacterIds(from?: Shot, to?: Shot): string[] {
  const a = new Set(from?.characterIds || []);
  const b = new Set(to?.characterIds || []);
  const inter = [...a].filter((id) => b.has(id));
  if (inter.length) return inter;
  return bridgeCharacterIds(from, to);
}

/** Build a bridge shot that sits between two story shots (by index). */
export function buildTransitionShot(
  afterShot: Shot,
  beforeNext: Shot,
  opts?: { id?: string; duration?: number }
): Shot {
  const fromLabel = `Shot ${afterShot.number}`;
  const toLabel = `Shot ${beforeNext.number}`;
  const charIds = preferredBridgeCharacterIds(afterShot, beforeNext);
  return {
    id: opts?.id || `tr-${Date.now().toString(36)}`,
    number: afterShot.number + 1,
    shotKind: 'transition',
    isTransition: true,
    bridgeFromShotId: afterShot.id,
    bridgeToShotId: beforeNext.id,
    description: [
      `CONTINUITY BRIDGE only — not a new scene.`,
      `Exit (${fromLabel}): ${(afterShot.description || '').slice(0, 100)}.`,
      `Enter (${toLabel}): ${(beforeNext.description || '').slice(0, 100)}.`,
      `Same geography, wardrobe, lighting temperature. Camera motivated move or match cut.`,
      `ONLY the established cast already in these shots. ZERO new people, ZERO random extras, ZERO crowd heroes.`,
    ].join(' '),
    camera: afterShot.cameraDetailed || afterShot.camera || 'Match cut / motivated move',
    duration: opts?.duration ?? 4,
    emotion: afterShot.emotion || beforeNext.emotion,
    actingCues: 'Micro-action only — connective tissue, no new plot, no new faces',
    cameraDetailed: `Bridge: exit energy of shot ${afterShot.number} → entry of shot ${beforeNext.number}. Continuous world.`,
    styleNotes:
      'TRANSITION LOCK: same series bible. Forbidden: new characters, costume changes, location jumps, myth cameos.',
    characterIds: charIds,
    dialogue: undefined,
  };
}

/** Insert transition after shot at `afterIndex` (0-based). */
export function insertTransitionAfter(shots: Shot[], afterIndex: number): Shot[] {
  if (afterIndex < 0 || afterIndex >= shots.length - 1) return shots;
  const a = shots[afterIndex];
  const b = shots[afterIndex + 1];
  if (isTransitionShot(shots[afterIndex + 1]) && shots[afterIndex + 1].bridgeFromShotId === a.id) {
    return shots;
  }
  // Don't bridge from/to another bridge
  if (isTransitionShot(a) || isTransitionShot(b)) return shots;

  const bridge = buildTransitionShot(a, b);
  const next = [...shots.slice(0, afterIndex + 1), bridge, ...shots.slice(afterIndex + 1)];
  return next.map((s, i) => ({ ...s, number: i + 1 }));
}

function castLockBlock(project: Project, charIds: string[]): string {
  const cast = (project.characters || []).filter((c) => charIds.includes(c.id));
  if (!cast.length) {
    return (
      'CAST LOCK: If any people appear, they must already exist in the neighboring shots of this series. ' +
      'Do NOT invent new named or unnamed characters. Empty environment bridge preferred over random people.'
    );
  }
  const names = cast.map((c) => c.name).join(', ');
  const detail = cast.map((c) => characterMemoryBlock(c)).join(' | ');
  return (
    `CAST LOCK — ONLY these original series characters may appear: ${names}. ` +
    `Exact likeness and wardrobe continuity. FORBIDDEN: any other human, face, extra, passerby, or cameo. ` +
    `If a face is not one of [${names}], do not draw it. Character memory: ${detail}.`
  );
}

/**
 * Prompt for bridge still or bridge motion.
 * Never applies berserker "summon" language — bridges are continuity, not myth drops.
 */
export function buildBridgePrompt(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot,
  kind: 'frame' | 'video' = 'video'
): string {
  const charIds =
    bridge.characterIds?.length
      ? bridge.characterIds
      : preferredBridgeCharacterIds(from, to);

  const parts = [
    kind === 'video'
      ? `Short continuity transition clip for original series "${project.title}".`
      : `Continuity bridge still for original series "${project.title}".`,
    'This is NOT a new scene and NOT a cold open. One continuous world between two existing beats.',
    from && `FROM beat (must match): ${(from.description || '').slice(0, 160)}.`,
    to && `TO beat (must land in): ${(to.description || '').slice(0, 160)}.`,
    bridge.description,
    project.style?.description && `Style DNA: ${project.style.description}.`,
    project.worldBible?.visualLaws && `Visual laws: ${project.worldBible.visualLaws}.`,
    project.worldBible?.whatNever && `Never: ${project.worldBible.whatNever}.`,
    project.continuity?.doNotBreak && `Do not break: ${project.continuity.doNotBreak}.`,
    project.continuity?.wardrobeRules && `Wardrobe continuity: ${project.continuity.wardrobeRules}.`,
    project.continuity?.locations && `Locations: ${project.continuity.locations}.`,
    castLockBlock(project, charIds),
    kind === 'video'
      ? 'Smooth continuous motion, match lighting and wardrobe, native ambient audio, no dialogue inventing new plot.'
      : 'Single still plate, readable continuity, same grade as neighbors.',
    'No copyrighted characters. No random mythic figures. No new cast members.',
  ];

  return parts.filter(Boolean).join(' ');
}

/** @deprecated use buildBridgePrompt */
export function buildBridgeVideoPrompt(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot
): string {
  return buildBridgePrompt(project, bridge, from, to, 'video');
}

/** Best seed image for bridge i2v: bridge still, else from-shot frame, else to-shot frame. */
export function bridgeSeedImageUrl(bridge: Shot, from?: Shot, to?: Shot): string | undefined {
  return bridge.imageUrl || from?.imageUrl || to?.imageUrl;
}

/** Reference images for continuity: style + cast refs + neighbor frames. */
export function bridgeReferenceImages(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot
): string[] {
  const charIds =
    bridge.characterIds?.length
      ? bridge.characterIds
      : preferredBridgeCharacterIds(from, to);
  const urls = [
    project.style?.referenceImageUrl,
    ...(project.characters || [])
      .filter((c) => charIds.includes(c.id))
      .map((c) => c.referenceImageUrl),
    from?.imageUrl,
    to?.imageUrl,
    bridge.imageUrl,
  ].filter(Boolean) as string[];
  return [...new Set(urls)];
}

export function shotsForFinalRender(shots: Shot[], opts?: { dropStillBridges?: boolean }): Shot[] {
  if (!opts?.dropStillBridges) return shots;
  return shots.filter((s) => {
    if (!isTransitionShot(s)) return true;
    return !!s.videoUrl;
  });
}
