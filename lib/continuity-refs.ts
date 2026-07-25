/**
 * Continuity references — surgical image-edit, not "concept art with hints".
 *
 * Product rule: once a set/cast is locked, later frames must EDIT a real plate
 * (prior shot or set plate). Long invent-style prompts + multi-ref remix still
 * spawn extra people and random props — so we:
 *   1) Prefer a single base plate (prior same-set frame)
 *   2) Use a short delta-only edit prompt
 *   3) Hard-lock cast count (exactly N named people; remove everyone else)
 *   4) Auto-inherit cast + set from previous same-set shot
 */

import type { Project, Shot, EnvironmentLocation, Character } from '@/lib/types';
import { isTransitionShot } from '@/lib/transitions';

const HTTPS = /^https?:\/\//i;
/** xAI multi-image edit supports up to 3 refs — we often use 1 for tighter lock */
export const MAX_CONTINUITY_REFS = 3;

function isPublicUrl(u: unknown): u is string {
  return typeof u === 'string' && HTTPS.test(u) && !u.includes('picsum.photos');
}

function uniqueUrls(urls: string[], max = MAX_CONTINUITY_REFS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!isPublicUrl(u)) continue;
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

export function resolveShotEnvironment(
  project: Project,
  shot: Shot
): EnvironmentLocation | undefined {
  const envId = shot.environmentId || project.defaultEnvironmentId;
  if (!envId) return undefined;
  return (project.environments || []).find((e) => e.id === envId);
}

export function environmentRefUrls(env?: EnvironmentLocation | null): string[] {
  if (!env) return [];
  const fromLock = env.consistencyLock?.referenceUrls || [];
  return uniqueUrls([env.referenceImageUrl || '', ...fromLock], 4);
}

export function characterRefUrls(c: Character): string[] {
  const fromLock = c.consistencyLock?.referenceUrls || [];
  return uniqueUrls([c.referenceImageUrl || '', ...fromLock], 4);
}

/** Story shots with frames, ordered by number */
function framedStoryShots(project: Project, excludeId?: string): Shot[] {
  return (project.shots || [])
    .filter((s) => !isTransitionShot(s) && s.id !== excludeId && isPublicUrl(s.imageUrl))
    .sort((a, b) => (a.number || 0) - (b.number || 0));
}

/**
 * Previous framed story shot that shares this set — best episode anchor.
 */
export function previousSameSetShot(project: Project, shot: Shot): Shot | undefined {
  const envId = shot.environmentId || project.defaultEnvironmentId;
  const shots = framedStoryShots(project, shot.id);

  if (envId) {
    const same = [...shots]
      .reverse()
      .find((s) => (s.environmentId || project.defaultEnvironmentId) === envId);
    if (same) return same;
  }

  // Prefer immediate previous by number
  const prev = [...shots]
    .filter((s) => (s.number || 0) < (shot.number || 0))
    .sort((a, b) => (b.number || 0) - (a.number || 0))[0];
  return prev;
}

export function previousSameSetFrameUrl(project: Project, shot: Shot): string | undefined {
  const prev = previousSameSetShot(project, shot);
  return isPublicUrl(prev?.imageUrl) ? prev!.imageUrl : undefined;
}

export type ContinuityRefBundle = {
  urls: string[];
  labels: string[];
  environment?: EnvironmentLocation;
  cast: Character[];
  hasEnvPlate: boolean;
  hasCastPlate: boolean;
  hasPriorFrame: boolean;
  useEdit: boolean;
  /** Base plate is the single most important image (edit this) */
  baseUrl?: string;
  strategy: 'prior-frame' | 'set-plate' | 'cast-plate' | 'none';
};

/**
 * Collect continuity refs with PRIOR FRAME as the primary base.
 * Multi-ref only adds DISTINCT character sheets when needed (max 3 total).
 */
export function collectContinuityRefs(project: Project, shot: Shot): ContinuityRefBundle {
  const env = resolveShotEnvironment(project, shot);
  const envUrls = environmentRefUrls(env);
  const cast = (project.characters || []).filter((c) =>
    (shot.characterIds || []).includes(c.id)
  );
  const prior = previousSameSetFrameUrl(project, shot);

  type Labeled = { url: string; label: string; role: 'base' | 'cast' | 'set' };
  const queue: Labeled[] = [];

  const wantsCast = cast.length > 0;

  // 0) Retake: edit THIS shot's existing frame
  if (isPublicUrl(shot.imageUrl)) {
    queue.push({
      url: shot.imageUrl!,
      label: wantsCast
        ? 'THIS shot plate — retake/edit; keep room + selected cast locked'
        : 'THIS shot plate — retake; SET ONLY — remove people if present',
      role: 'base',
    });
  } else if (!wantsCast && envUrls[0]) {
    // Set-only: prefer clean set plate over a prior shot full of people
    queue.push({
      url: envUrls[0],
      label: `LOCKED SET plate "${env?.name || 'set'}" — empty room geometry; no characters`,
      role: 'base',
    });
  } else if (prior) {
    queue.push({
      url: prior,
      label: wantsCast
        ? 'LOCKED production still (prior shot) — edit THIS image'
        : 'Prior still for SET continuity — REMOVE all people; keep only the room',
      role: 'base',
    });
  } else if (envUrls[0]) {
    queue.push({
      url: envUrls[0],
      label: `LOCKED SET plate "${env?.name || 'set'}" — keep this room geometry`,
      role: 'base',
    });
  }

  // Character sheets only when director actually selected cast on this shot
  if (wantsCast) {
    for (const c of cast) {
      const u = characterRefUrls(c)[0];
      if (!u) continue;
      if (prior && u.split('?')[0] === prior.split('?')[0]) continue;
      if (envUrls[0] && u.split('?')[0] === envUrls[0].split('?')[0]) continue;
      if (shot.imageUrl && u.split('?')[0] === shot.imageUrl.split('?')[0]) continue;
      queue.push({
        url: u,
        label: `LOCKED CHARACTER likeness "${c.name}" — match this face/wardrobe only`,
        role: 'cast',
      });
    }
  }

  const urls: string[] = [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of queue) {
    if (!isPublicUrl(item.url)) continue;
    const key = item.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(item.url);
    labels.push(item.label);
    if (urls.length >= MAX_CONTINUITY_REFS) break;
  }

  const strategy: ContinuityRefBundle['strategy'] = isPublicUrl(shot.imageUrl)
    ? 'prior-frame' // retake of current still
    : prior
      ? 'prior-frame'
      : envUrls[0]
        ? 'set-plate'
        : urls.length
          ? 'cast-plate'
          : 'none';

  return {
    urls,
    labels,
    environment: env,
    cast,
    hasEnvPlate: envUrls.length > 0,
    hasCastPlate: cast.some((c) => characterRefUrls(c).length > 0),
    hasPriorFrame: !!prior,
    useEdit: urls.length > 0,
    baseUrl: urls[0],
    strategy,
  };
}

/**
 * Short, surgical edit prompt. Long "masterpiece sitcom frame" prompts
 * cause the model to invent extras and props even when image-editing.
 */
export function buildStrictContinuityEditPrompt(
  project: Project,
  shot: Shot,
  bundle: ContinuityRefBundle
): string {
  const cast =
    bundle.cast.length > 0
      ? bundle.cast
      : (project.characters || []).filter((c) => (shot.characterIds || []).includes(c.id));
  const n = cast.length;
  const names = cast.map((c) => c.name);

  const castBlock =
    n === 0
      ? 'PEOPLE: EMPTY CAST LOCK — director wants NO characters in this shot. ' +
        'Remove every person from the frame completely (no faces, silhouettes, crowd, reflections of people). ' +
        'Environment / set plate only. Do not invent characters.'
      : `PEOPLE: EXACTLY ${n} person(s) visible — ${names.join(', ')} only. ` +
        `Remove every other person completely (no silhouettes, no reflections of strangers, no crowd). ` +
        `No new characters. No face merges.`;

  const likeness =
    n > 0
      ? cast
          .map((c) => {
            const bits = [
              c.name,
              c.faceNotes && `face:${c.faceNotes}`,
              c.wardrobe && `wardrobe:${c.wardrobe}`,
              c.consistencyLock?.doNotChange,
            ].filter(Boolean);
            return bits.join(' — ');
          })
          .join(' | ')
      : '';

  const env = bundle.environment;
  const setBlock = env
    ? `SET: Stay inside "${env.name}" (${env.placeType}). ` +
      `Same walls, furniture layout, colors, windows, lighting fixtures, and signature props. ` +
      `${env.consistencyLock?.doNotChange || 'Do not redesign the room.'} ` +
      `Camera may move; architecture may not.`
    : 'SET: Preserve the exact room/background from Image 1. Do not invent a different location.';

  const imageRoles = bundle.labels
    .map((label, i) => `Image ${i + 1}: ${label}.`)
    .join(' ');

  const action = (shot.description || '').trim() || 'Continue the scene with a clear new beat.';
  const camera = (shot.camera || shot.cameraDetailed || 'Same coverage, slight reframing').trim();
  const emotion = (shot.emotion || shot.actingCues || '').trim();
  const dialogue = (shot.dialogue || '').trim();

  // Keep this SHORT — edit models ignore or fight giant bible dumps
  const parts = [
    'SURGICAL IMAGE EDIT for series continuity. Edit the source image(s); do NOT generate a new concept-art scene.',
    imageRoles,
    setBlock,
    castBlock,
    likeness ? `LIKENESS LOCK: ${likeness}.` : '',
    `ALLOWED CHANGES ONLY: framing/camera (${camera}); action (${action})${emotion ? `; performance (${emotion})` : ''}${
      dialogue ? `; spoken moment ("${dialogue}")` : ''
    }.`,
    'FORBIDDEN: extra people, random new objects, new furniture, new posters/screens, new animals, logos, watermarks, text overlays, celebrity lookalikes, redesigning the room.',
    'Output one still that could cut next to Image 1 in the same episode.',
  ];

  return parts.filter(Boolean).join(' ');
}

/** @deprecated use buildStrictContinuityEditPrompt */
export function continuityEditPrefix(bundle: ContinuityRefBundle, shot: Shot): string {
  // Minimal fallback if old call sites remain
  if (!bundle.urls.length) return '';
  return buildStrictContinuityEditPrompt(
    { characters: bundle.cast, environments: bundle.environment ? [bundle.environment] : [] } as Project,
    shot,
    bundle
  );
}

/**
 * Bind default SET only. Never auto-select cast.
 *
 * Empty characterIds is intentional director choice = environment-only /
 * no forced people. Auto-filling cast (prior shot / all chars ≤4) was a bug:
 * user picks "den" only → regenerate forced "chaos" + "background" chips.
 */
export function ensureShotContinuityBindings(project: Project, shot: Shot): Shot {
  let next = { ...shot };

  if (!next.environmentId) {
    if (project.defaultEnvironmentId) next.environmentId = project.defaultEnvironmentId;
    else if (project.environments?.[0]?.id) next.environmentId = project.environments[0].id;
  }

  // Do NOT touch characterIds — empty means no cast lock on this shot.
  return next;
}

export function ensureShotEnvironmentId(project: Project, shot: Shot): Shot {
  return ensureShotContinuityBindings(project, shot);
}

/**
 * After a successful frame gen in a set that had no plate, promote this frame
 * to the environment reference plate so future shots can image-edit from it.
 * Also always append as an extra ref URL for richer history.
 */
export function promoteFrameToEnvPlate(
  project: Project,
  shot: Shot,
  imageUrl: string
): Project {
  if (!isPublicUrl(imageUrl)) return project;
  const envId = shot.environmentId || project.defaultEnvironmentId;
  if (!envId) return project;
  const env = (project.environments || []).find((e) => e.id === envId);
  if (!env) return project;

  const hadPlate = !!(env.referenceImageUrl && env.consistencyLock?.referenceUrls?.length);

  return {
    ...project,
    environments: (project.environments || []).map((e) => {
      if (e.id !== envId) return e;
      const refs = uniqueUrls(
        [
          // Keep established plate first; still track latest frame
          e.referenceImageUrl || imageUrl,
          imageUrl,
          ...(e.consistencyLock?.referenceUrls || []),
        ],
        6
      );
      return {
        ...e,
        // Only set primary plate if missing — do not overwrite a good lock with a drift frame
        referenceImageUrl: e.referenceImageUrl || imageUrl,
        consistencyLock: {
          modelSheet:
            e.consistencyLock?.modelSheet || `${e.name} — ${e.description}`,
          doNotChange:
            e.consistencyLock?.doNotChange ||
            'Never redesign architecture, wall color, furniture layout, or signature props. Same place every time. No random new objects.',
          referenceUrls: refs,
          locked: true,
          lockedAt: e.consistencyLock?.lockedAt || new Date().toISOString(),
        },
      };
    }),
    // Also stamp character plates from this frame if cast is on the shot and char has no plate
    characters: (project.characters || []).map((c) => {
      if (!(shot.characterIds || []).includes(c.id)) return c;
      if (c.referenceImageUrl && c.consistencyLock?.locked) return c;
      return {
        ...c,
        referenceImageUrl: c.referenceImageUrl || imageUrl,
        consistencyLock: {
          modelSheet: c.consistencyLock?.modelSheet || `${c.name} — ${c.description}`,
          doNotChange:
            c.consistencyLock?.doNotChange ||
            'Exact face, hair, body, wardrobe. No redesign.',
          referenceUrls: uniqueUrls(
            [c.referenceImageUrl || imageUrl, imageUrl, ...(c.consistencyLock?.referenceUrls || [])],
            4
          ),
          locked: true,
          lockedAt: c.consistencyLock?.lockedAt || new Date().toISOString(),
        },
      };
    }),
    // silence unused
    ...(hadPlate ? {} : {}),
  };
}

export function bindEnvironmentAcrossProject(
  project: Project,
  envId: string,
  opts?: { onlyEmpty?: boolean; alsoShotIds?: string[] }
): Project {
  const onlyEmpty = opts?.onlyEmpty !== false;
  const also = new Set(opts?.alsoShotIds || []);
  return {
    ...project,
    defaultEnvironmentId: project.defaultEnvironmentId || envId,
    shots: (project.shots || []).map((s) => {
      if (isTransitionShot(s)) return s;
      if (also.has(s.id)) return { ...s, environmentId: envId };
      if (onlyEmpty && (s.imageUrl || s.videoUrl) && s.environmentId) return s;
      if (onlyEmpty && (s.imageUrl || s.videoUrl) && !also.has(s.id)) {
        return s.environmentId ? s : { ...s, environmentId: envId };
      }
      return { ...s, environmentId: s.environmentId || envId };
    }),
  };
}

/**
 * True when this shot should refuse pure text-to-image (locks exist).
 */
export function shotRequiresContinuityEdit(project: Project, shot: Shot): boolean {
  const bound = ensureShotContinuityBindings(project, shot);
  const hasSet = !!(bound.environmentId || project.defaultEnvironmentId || (project.environments || []).length);
  const hasCast = (bound.characterIds || []).length > 0 || (project.characters || []).some((c) => c.consistencyLock?.locked);
  const bundle = collectContinuityRefs(project, bound);
  return (hasSet || hasCast) && bundle.useEdit;
}
