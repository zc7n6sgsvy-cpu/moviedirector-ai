/**
 * Transition bridges — director-controlled continuity between story clips.
 *
 * Workflow (polished version of the "in-between frame" idea):
 * 1. Between shot A and shot B, insert a BRIDGE still (cheap look test).
 * 2. Optionally animate that still into a short BRIDGE CLIP.
 * 3. At final assemble, you can keep the bridge clip OR drop the still and
 *    generate a pure A→B motion bridge (image-to-video from A's last frame
 *    toward B's first frame) for smoother edits.
 *
 * Planning the bridge freezes intent before you burn full-length clip credits.
 */

import type { Project, Shot } from '@/lib/types';

export function isTransitionShot(shot: Shot): boolean {
  return shot.shotKind === 'transition' || !!shot.isTransition;
}

/** Build a bridge shot that sits between two story shots (by index). */
export function buildTransitionShot(
  afterShot: Shot,
  beforeNext: Shot,
  opts?: { id?: string; duration?: number }
): Shot {
  const fromLabel = `Shot ${afterShot.number}`;
  const toLabel = `Shot ${beforeNext.number}`;
  return {
    id: opts?.id || `tr-${Date.now().toString(36)}`,
    number: afterShot.number + 1, // renumbered by caller
    shotKind: 'transition',
    isTransition: true,
    bridgeFromShotId: afterShot.id,
    bridgeToShotId: beforeNext.id,
    description: `TRANSITION BRIDGE: Morph energy from (${fromLabel}) “${(afterShot.description || '').slice(0, 80)}” into (${toLabel}) “${(beforeNext.description || '').slice(0, 80)}”. Match wardrobe, lighting continuity, and geography. One connective beat — not a new scene.`,
    camera: afterShot.cameraDetailed || afterShot.camera || 'Match cut / motivated move',
    duration: opts?.duration ?? 4,
    emotion: afterShot.emotion || beforeNext.emotion,
    actingCues: 'Continuity performance — no new plot, only connective tissue',
    cameraDetailed: `Bridge camera: exit energy of shot ${afterShot.number} → entry energy of shot ${beforeNext.number}`,
    styleNotes: 'Transition plate — may be discarded after bridge clip is locked',
    characterIds: Array.from(
      new Set([...(afterShot.characterIds || []), ...(beforeNext.characterIds || [])])
    ),
    dialogue: undefined,
  };
}

/** Insert transition after shot at `afterIndex` (0-based). Returns new full shot list. */
export function insertTransitionAfter(shots: Shot[], afterIndex: number): Shot[] {
  if (afterIndex < 0 || afterIndex >= shots.length - 1) return shots;
  const a = shots[afterIndex];
  const b = shots[afterIndex + 1];
  if (isTransitionShot(a) || isTransitionShot(b)) {
    // Don't stack double transitions by default
    const alreadyBetween =
      isTransitionShot(shots[afterIndex + 1]) &&
      shots[afterIndex + 1].bridgeFromShotId === a.id;
    if (alreadyBetween) return shots;
  }
  const bridge = buildTransitionShot(a, b);
  const next = [...shots.slice(0, afterIndex + 1), bridge, ...shots.slice(afterIndex + 1)];
  return next.map((s, i) => ({ ...s, number: i + 1 }));
}

/**
 * Prompt for a pure motion bridge once both neighbors are live clips —
 * uses neighbor descriptions + optional bridge still as image-to-video seed.
 */
export function buildBridgeVideoPrompt(project: Project, bridge: Shot, from?: Shot, to?: Shot): string {
  const parts = [
    `Cinematic transition clip for "${project.title}".`,
    from && `FROM beat: ${from.description}.`,
    to && `TO beat: ${to.description}.`,
    bridge.description,
    project.style?.description && `Style: ${project.style.description}.`,
    project.generationSettings?.masterPrompt,
    'Smooth continuous motion, match lighting and wardrobe, no new plot points, native ambient audio.',
    'No copyrighted characters.',
  ];
  return parts.filter(Boolean).join(' ');
}

/** Shots used for final render — optionally drop pure still transitions that have no video. */
export function shotsForFinalRender(shots: Shot[], opts?: { dropStillBridges?: boolean }): Shot[] {
  if (!opts?.dropStillBridges) return shots;
  return shots.filter((s) => {
    if (!isTransitionShot(s)) return true;
    // Keep transition if it has a video bridge; drop still-only planning plates
    return !!s.videoUrl;
  });
}
