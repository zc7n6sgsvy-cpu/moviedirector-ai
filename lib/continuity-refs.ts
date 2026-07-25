/**
 * Continuity references — the only way set/cast locks actually hold.
 *
 * Text prompts alone do NOT keep a room or face the same across gens.
 * We always prefer image-edit / multi-ref grounded on:
 *   1) locked environment plate
 *   2) locked character model sheets
 *   3) previous shot in the same set (episode continuity)
 *   4) style DNA plate
 *
 * xAI edit path currently accepts a small set of public https URLs.
 */

import type { Project, Shot, EnvironmentLocation, Character } from '@/lib/types';
import { isTransitionShot } from '@/lib/transitions';

const HTTPS = /^https?:\/\//i;
/** Grok multi-image edit cap we honor client-side */
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

/**
 * Previous framed story shot that shares this set — best episode anchor
 * when the locked plate is weak or missing.
 */
export function previousSameSetFrameUrl(
  project: Project,
  shot: Shot
): string | undefined {
  const envId = shot.environmentId || project.defaultEnvironmentId;
  const shots = (project.shots || [])
    .filter((s) => !isTransitionShot(s) && s.id !== shot.id && !!s.imageUrl)
    .sort((a, b) => (a.number || 0) - (b.number || 0));

  // Prefer earlier shot with same environmentId
  if (envId) {
    const same = [...shots]
      .reverse()
      .find(
        (s) =>
          (s.environmentId || project.defaultEnvironmentId) === envId &&
          isPublicUrl(s.imageUrl)
      );
    if (same?.imageUrl) return same.imageUrl;
  }

  // Fall back: immediately previous numbered frame
  const prev = [...shots]
    .filter((s) => (s.number || 0) < (shot.number || 0))
    .sort((a, b) => (b.number || 0) - (a.number || 0))[0];
  return isPublicUrl(prev?.imageUrl) ? prev!.imageUrl : undefined;
}

export type ContinuityRefBundle = {
  /** Ordered URLs for editImage / reference-to-video (max MAX_CONTINUITY_REFS) */
  urls: string[];
  /** Human labels parallel to urls for prompt indexing (Image 1 = set, etc.) */
  labels: string[];
  environment?: EnvironmentLocation;
  hasEnvPlate: boolean;
  hasCastPlate: boolean;
  hasPriorFrame: boolean;
  /** Force image-edit path when true */
  useEdit: boolean;
};

/**
 * Collect continuity image refs for a story shot (not bridges — those use bridge helpers).
 * Priority: env plate → cast sheets → prior same-set frame → style.
 */
export function collectContinuityRefs(project: Project, shot: Shot): ContinuityRefBundle {
  const env = resolveShotEnvironment(project, shot);
  const envUrls = environmentRefUrls(env);
  const cast = (project.characters || []).filter((c) =>
    (shot.characterIds || []).includes(c.id)
  );
  const castUrls = cast.flatMap(characterRefUrls);
  const prior = previousSameSetFrameUrl(project, shot);
  const style = project.style?.referenceImageUrl;

  // Build labeled queue in priority order, then unique-cap
  type Labeled = { url: string; label: string };
  const queue: Labeled[] = [];

  if (envUrls[0]) {
    queue.push({ url: envUrls[0], label: `LOCKED SET plate "${env?.name || 'set'}"` });
  }
  for (const c of cast) {
    const u = characterRefUrls(c)[0];
    if (u) queue.push({ url: u, label: `LOCKED CHARACTER "${c.name}" model sheet` });
  }
  // Prior frame only if we still have room and it isn't the same as env/cast already
  if (prior) {
    queue.push({
      url: prior,
      label: 'PRIOR SHOT in same episode/set — keep architecture continuous',
    });
  }
  if (style && isPublicUrl(style)) {
    queue.push({ url: style, label: 'Style DNA plate' });
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

  return {
    urls,
    labels,
    environment: env,
    hasEnvPlate: envUrls.length > 0,
    hasCastPlate: castUrls.length > 0,
    hasPriorFrame: !!prior,
    useEdit: urls.length > 0,
  };
}

/**
 * Hard continuity instructions prepended when image-edit refs are present.
 * Models ignore soft "same room" text; indexed image roles work far better.
 */
export function continuityEditPrefix(bundle: ContinuityRefBundle, shot: Shot): string {
  if (!bundle.urls.length) return '';

  const lines = bundle.labels.map(
    (label, i) =>
      `Image ${i + 1} is the ${label}. Match it exactly — do not invent a different place or face.`
  );

  const env = bundle.environment;
  const envLaw = env
    ? `SET LAW: This is "${env.name}" (${env.placeType}). ${env.consistencyLock?.modelSheet || env.description || ''}. ${
        env.consistencyLock?.doNotChange ||
        'Never redesign architecture, wall color, furniture layout, windows, or signature props.'
      } Camera and action may change; the LOCATION must stay identical.`
    : 'Preserve background/architecture from the set reference image.';

  const castLaw =
    (shot.characterIds || []).length > 0
      ? 'CAST LAW: Faces, hair, body type, and wardrobe of locked characters must match their reference plates. No new people. No face merges.'
      : '';

  return [
    'CONTINUITY IMAGE-EDIT (series lock — not a new concept art).',
    ...lines,
    envLaw,
    castLaw,
    `NEW SHOT #${shot.number}: apply the action and framing below WHILE holding set + cast from the reference images.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Ensure shot carries environmentId when project has a default set.
 * Call before prompt + ref collection so empty shots inherit the locked world.
 */
export function ensureShotEnvironmentId(project: Project, shot: Shot): Shot {
  if (shot.environmentId) return shot;
  if (project.defaultEnvironmentId) {
    return { ...shot, environmentId: project.defaultEnvironmentId };
  }
  const only = project.environments?.[0]?.id;
  if (only) return { ...shot, environmentId: only };
  return shot;
}

/**
 * After a successful frame gen in a set that had no plate, promote this frame
 * to the environment reference plate so future shots can image-edit from it.
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
  // Don't overwrite a dedicated plate if one already exists
  if (env.referenceImageUrl && env.consistencyLock?.locked && env.consistencyLock.referenceUrls?.length) {
    return project;
  }

  return {
    ...project,
    environments: (project.environments || []).map((e) =>
      e.id === envId
        ? {
            ...e,
            referenceImageUrl: e.referenceImageUrl || imageUrl,
            consistencyLock: {
              modelSheet:
                e.consistencyLock?.modelSheet ||
                `${e.name} — ${e.description}`,
              doNotChange:
                e.consistencyLock?.doNotChange ||
                'Never redesign architecture, wall color, furniture layout, or signature props. Same place every time.',
              referenceUrls: uniqueUrls(
                [e.referenceImageUrl || imageUrl, imageUrl, ...(e.consistencyLock?.referenceUrls || [])],
                4
              ),
              locked: true,
              lockedAt: e.consistencyLock?.lockedAt || new Date().toISOString(),
            },
          }
        : e
    ),
  };
}

/**
 * After discover lock: bind set on all empty story shots + set default.
 */
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
        // Keep existing framed shots' set if already set; else bind
        return s.environmentId ? s : { ...s, environmentId: envId };
      }
      return { ...s, environmentId: s.environmentId || envId };
    }),
  };
}
