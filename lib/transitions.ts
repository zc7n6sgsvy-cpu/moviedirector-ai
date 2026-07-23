/**
 * Transition bridges — continuity tissue between story clips.
 *
 * Critical: bridge FRAMES must be image-edits grounded in neighbor frames,
 * not text-to-image. Text-only bridges invent unrelated scenes.
 */

import type { Project, Shot } from '@/lib/types';
import { characterMemoryBlock } from '@/lib/character-memory';

export function isTransitionShot(shot: Shot): boolean {
  return shot.shotKind === 'transition' || !!shot.isTransition;
}

export function bridgeCharacterIds(from?: Shot, to?: Shot): string[] {
  const ids = new Set<string>([...(from?.characterIds || []), ...(to?.characterIds || [])]);
  return [...ids];
}

export function preferredBridgeCharacterIds(from?: Shot, to?: Shot): string[] {
  const a = new Set(from?.characterIds || []);
  const b = new Set(to?.characterIds || []);
  const inter = [...a].filter((id) => b.has(id));
  if (inter.length) return inter;
  return bridgeCharacterIds(from, to);
}

/** Environment ids from neighbors for set continuity */
export function preferredBridgeEnvironmentId(from?: Shot, to?: Shot, projectDefault?: string): string | undefined {
  return from?.environmentId || to?.environmentId || projectDefault;
}

export function buildTransitionShot(
  afterShot: Shot,
  beforeNext: Shot,
  opts?: { id?: string; duration?: number; defaultEnvironmentId?: string }
): Shot {
  const fromLabel = `Shot ${afterShot.number}`;
  const toLabel = `Shot ${beforeNext.number}`;
  const charIds = preferredBridgeCharacterIds(afterShot, beforeNext);
  const envId = preferredBridgeEnvironmentId(afterShot, beforeNext, opts?.defaultEnvironmentId);
  return {
    id: opts?.id || `tr-${Date.now().toString(36)}`,
    number: afterShot.number + 1,
    shotKind: 'transition',
    isTransition: true,
    bridgeFromShotId: afterShot.id,
    bridgeToShotId: beforeNext.id,
    description: [
      `MIDPOINT CONTINUITY between two EXISTING frames of the same scene continuum.`,
      `Must look like a natural in-between of:`,
      `(A ${fromLabel}) ${(afterShot.description || '').slice(0, 120)}`,
      `and (B ${toLabel}) ${(beforeNext.description || '').slice(0, 120)}.`,
      `Same location, same grade, same wardrobe. NOT a new location. NOT a new scene.`,
    ].join(' '),
    camera: afterShot.cameraDetailed || afterShot.camera || 'Match cut / motivated move',
    duration: opts?.duration ?? 4,
    emotion: afterShot.emotion || beforeNext.emotion,
    actingCues: 'Micro-action only — connective tissue between A and B',
    cameraDetailed: `Camera continues from shot ${afterShot.number} toward shot ${beforeNext.number}.`,
    styleNotes:
      'BRIDGE: grounded in reference frames A and B. Forbidden: new cast, new set, costume change, myth cameo.',
    characterIds: charIds,
    environmentId: envId,
    dialogue: undefined,
  };
}

export function insertTransitionAfter(shots: Shot[], afterIndex: number, defaultEnvironmentId?: string): Shot[] {
  if (afterIndex < 0 || afterIndex >= shots.length - 1) return shots;
  const a = shots[afterIndex];
  const b = shots[afterIndex + 1];
  if (isTransitionShot(shots[afterIndex + 1]) && shots[afterIndex + 1].bridgeFromShotId === a.id) {
    return shots;
  }
  if (isTransitionShot(a) || isTransitionShot(b)) return shots;

  const bridge = buildTransitionShot(a, b, { defaultEnvironmentId });
  const next = [...shots.slice(0, afterIndex + 1), bridge, ...shots.slice(afterIndex + 1)];
  return next.map((s, i) => ({ ...s, number: i + 1 }));
}

function castLockBlock(project: Project, charIds: string[]): string {
  const cast = (project.characters || []).filter((c) => charIds.includes(c.id));
  if (!cast.length) {
    return (
      'Prefer NO new people. If people appear they must match the people visible in the reference frames only. ' +
      'Empty connecting space is better than inventing a stranger.'
    );
  }
  const names = cast.map((c) => c.name).join(', ');
  const detail = cast.map((c) => characterMemoryBlock(c)).join(' | ');
  return (
    `ONLY these characters: ${names}. Exact likeness from references and from frames A/B. ` +
    `FORBIDDEN: any other face or body. ${detail}`
  );
}

/**
 * Prompt for bridge — assumes image edit with frame A (+ optionally B) as sources.
 * Order: first image = FROM (A), second = TO (B).
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

  const envId = bridge.environmentId || from?.environmentId || to?.environmentId || project.defaultEnvironmentId;
  const env = (project.environments || []).find((e) => e.id === envId);

  if (kind === 'frame') {
    // Image-edit oriented prompt — references are the ground truth
    return [
      'Create a SINGLE continuity bridge still that sits BETWEEN the provided reference frames.',
      'Image 1 (or only image) = SCENE A — the outgoing beat. Image 2 (if present) = SCENE B — the incoming beat.',
      'Output must be a visual midpoint: same world, same people, same lighting family as A and B.',
      'It must look like one more frame of THIS sequence — not a new movie, not a stock photo, not a different location.',
      from && `Scene A intent: ${(from.description || '').slice(0, 200)}.`,
      to && `Scene B intent: ${(to.description || '').slice(0, 200)}.`,
      bridge.description,
      project.style?.description && `Style DNA (match A/B): ${project.style.description}.`,
      env &&
        `LOCKED SET "${env.name}": ${env.description}. ${env.consistencyLock?.doNotChange || 'Do not redesign the set.'}`,
      project.worldBible?.visualLaws && `Visual laws: ${project.worldBible.visualLaws}.`,
      castLockBlock(project, charIds),
      'Preserve identity of every person already in the reference images. Do not invent new characters.',
      'Keep wardrobe, hair, and location continuous with the references.',
      'Mild camera move or pose change only — connective tissue, not a new plot beat.',
      'No text overlays, no logos, no copyrighted characters.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `Short continuity transition clip for original series "${project.title}".`,
    'Animate from the seed frame toward the next beat — same world as the still.',
    from && `FROM: ${(from.description || '').slice(0, 160)}.`,
    to && `TO: ${(to.description || '').slice(0, 160)}.`,
    bridge.description,
    project.style?.description && `Style: ${project.style.description}.`,
    env && `Set: ${env.name} — ${env.description}.`,
    castLockBlock(project, charIds),
    'Smooth continuous motion. No new faces. No new locations. Native ambient audio.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildBridgeVideoPrompt(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot
): string {
  return buildBridgePrompt(project, bridge, from, to, 'video');
}

export function bridgeSeedImageUrl(bridge: Shot, from?: Shot, to?: Shot): string | undefined {
  return bridge.imageUrl || from?.imageUrl || to?.imageUrl;
}

/** Up to 3 URLs for image edit: A frame, B frame, cast ref */
export function bridgeEditImageUrls(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot
): string[] {
  const charIds =
    bridge.characterIds?.length
      ? bridge.characterIds
      : preferredBridgeCharacterIds(from, to);
  const castRef = (project.characters || []).find(
    (c) => charIds.includes(c.id) && c.referenceImageUrl
  )?.referenceImageUrl;
  const envId = bridge.environmentId || from?.environmentId || to?.environmentId;
  const envRef = (project.environments || []).find((e) => e.id === envId)?.referenceImageUrl;

  const urls = [from?.imageUrl, to?.imageUrl, castRef || envRef || bridge.imageUrl].filter(
    Boolean
  ) as string[];
  // Dedupe preserve order, max 3
  const out: string[] = [];
  for (const u of urls) {
    if (!out.includes(u)) out.push(u);
    if (out.length >= 3) break;
  }
  return out;
}

export function bridgeReferenceImages(
  project: Project,
  bridge: Shot,
  from?: Shot,
  to?: Shot
): string[] {
  return bridgeEditImageUrls(project, bridge, from, to);
}

/** Neighbors must have frames before we burn a bridge still */
export function bridgeFrameReady(
  from?: Shot,
  to?: Shot
): { ok: boolean; reason?: string } {
  if (!from?.imageUrl && !to?.imageUrl) {
    return {
      ok: false,
      reason: 'Generate frames on both neighboring shots first — the bridge is edited FROM those frames, not invented from text.',
    };
  }
  if (!from?.imageUrl) {
    return {
      ok: false,
      reason: 'Generate a frame on the previous shot first (bridge seeds from it).',
    };
  }
  return { ok: true };
}

export function shotsForFinalRender(shots: Shot[], opts?: { dropStillBridges?: boolean }): Shot[] {
  if (!opts?.dropStillBridges) return shots;
  return shots.filter((s) => {
    if (!isTransitionShot(s)) return true;
    return !!s.videoUrl;
  });
}
