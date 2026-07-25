/**
 * Continuity references — surgical image-edit, not "concept art with hints".
 *
 * Identity rule (Dane bug): when the director tags character X, the output
 * person MUST be X — never another project cast member from a shared plate.
 */

import type { Project, Shot, EnvironmentLocation, Character } from '@/lib/types';
import { isTransitionShot } from '@/lib/transitions';

const HTTPS = /^https?:\/\//i;
/** xAI multi-image edit supports up to 3 refs — we often use 1 for tighter lock */
export const MAX_CONTINUITY_REFS = 3;

function isPublicUrl(u: unknown): u is string {
  return typeof u === 'string' && HTTPS.test(u) && !u.includes('picsum.photos');
}

function urlKey(u: string) {
  return u.split('?')[0];
}

function uniqueUrls(urls: string[], max = MAX_CONTINUITY_REFS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!isPublicUrl(u)) continue;
    const key = urlKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

function sameIds(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join('|');
  const sb = [...b].sort().join('|');
  return sa === sb;
}

/** True if this character's plate URL is shared with another cast member or the set plate */
export function characterHasSharedPlate(
  project: Project,
  character: Character,
  env?: EnvironmentLocation | null
): boolean {
  const mine = characterRefUrls(character)[0];
  if (!mine) return false;
  const key = urlKey(mine);
  if (env?.referenceImageUrl && urlKey(env.referenceImageUrl) === key) return true;
  for (const other of project.characters || []) {
    if (other.id === character.id) continue;
    const ou = characterRefUrls(other)[0];
    if (ou && urlKey(ou) === key) return true;
  }
  return false;
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

  const prev = [...shots]
    .filter((s) => (s.number || 0) < (shot.number || 0))
    .sort((a, b) => (b.number || 0) - (a.number || 0))[0];
  return prev;
}

/**
 * Prefer a prior frame that already featured the SAME cast ids.
 * Avoid basing a "Dane only" shot on a still that starred someone else.
 */
export function priorFrameMatchingCast(
  project: Project,
  shot: Shot
): Shot | undefined {
  const want = shot.characterIds || [];
  const envId = shot.environmentId || project.defaultEnvironmentId;
  const shots = framedStoryShots(project, shot.id)
    .filter((s) => (s.number || 0) < (shot.number || 0) || !shot.number)
    .reverse();

  // Exact cast match on same set
  const exact = shots.find(
    (s) =>
      sameIds(s.characterIds || [], want) &&
      (!envId || (s.environmentId || project.defaultEnvironmentId) === envId)
  );
  if (exact) return exact;

  // Sole character match (shot calls one person; prior also only that person)
  if (want.length === 1) {
    const sole = shots.find(
      (s) =>
        (s.characterIds || []).length === 1 &&
        s.characterIds![0] === want[0] &&
        (!envId || (s.environmentId || project.defaultEnvironmentId) === envId)
    );
    if (sole) return sole;
  }

  return undefined;
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
  /** Other project cast that must NOT appear */
  forbiddenCast: Character[];
  hasEnvPlate: boolean;
  hasCastPlate: boolean;
  hasPriorFrame: boolean;
  useEdit: boolean;
  baseUrl?: string;
  strategy: 'prior-frame' | 'set-plate' | 'cast-plate' | 'identity' | 'none';
  /** Selected cast shares multi-person discover plates */
  sharedPlateRisk: boolean;
};

/**
 * Collect continuity refs with IDENTITY-SAFE base selection.
 * Calling Dane must not start from a still that is mostly another character.
 */
export function collectContinuityRefs(project: Project, shot: Shot): ContinuityRefBundle {
  const env = resolveShotEnvironment(project, shot);
  const envUrls = environmentRefUrls(env);
  const cast = (project.characters || []).filter((c) =>
    (shot.characterIds || []).includes(c.id)
  );
  const forbiddenCast = (project.characters || []).filter(
    (c) => !(shot.characterIds || []).includes(c.id)
  );
  const wantsCast = cast.length > 0;
  const sharedPlateRisk = cast.some((c) => characterHasSharedPlate(project, c, env));

  const matchCastPrior = priorFrameMatchingCast(project, shot);
  const anyPrior = previousSameSetShot(project, shot);

  type Labeled = { url: string; label: string; role: 'base' | 'cast' | 'set' };
  const queue: Labeled[] = [];
  let strategy: ContinuityRefBundle['strategy'] = 'none';

  // 0) Retake current shot
  if (isPublicUrl(shot.imageUrl)) {
    queue.push({
      url: shot.imageUrl!,
      label: wantsCast
        ? `Retake plate — hero identity MUST be ${cast.map((c) => c.name).join(' + ')} only`
        : 'Retake plate — SET ONLY, remove people',
      role: 'base',
    });
    strategy = 'prior-frame';
  } else if (!wantsCast && envUrls[0]) {
    queue.push({
      url: envUrls[0],
      label: `SET plate "${env?.name || 'set'}" — empty room; no characters`,
      role: 'base',
    });
    strategy = 'set-plate';
  } else if (wantsCast && matchCastPrior?.imageUrl) {
    // Best: prior still already used this exact cast
    queue.push({
      url: matchCastPrior.imageUrl,
      label: `Prior still with SAME cast (${cast.map((c) => c.name).join(', ')}) — edit this; do not swap identity`,
      role: 'base',
    });
    strategy = 'identity';
  } else if (wantsCast && cast.length === 1 && sharedPlateRisk && envUrls[0]) {
    // Dane bug path: shared multi-person plate + single call → start from SET, not wrong hero still
    queue.push({
      url: envUrls[0],
      label: `SET plate for identity-safe insert of "${cast[0].name}" only — do not use other cast faces`,
      role: 'base',
    });
    strategy = 'identity';
  } else if (wantsCast && cast.length === 1 && characterRefUrls(cast[0])[0] && !sharedPlateRisk) {
    // Dedicated solo plate for this character
    queue.push({
      url: characterRefUrls(cast[0])[0],
      label: `Dedicated likeness plate for "${cast[0].name}" only`,
      role: 'base',
    });
    strategy = 'cast-plate';
  } else if (anyPrior?.imageUrl) {
    const priorCast = (anyPrior.characterIds || [])
      .map((id) => project.characters?.find((c) => c.id === id)?.name)
      .filter(Boolean);
    queue.push({
      url: anyPrior.imageUrl,
      label: wantsCast
        ? `Prior still (may show ${priorCast.join(', ') || 'others'}) — REPLACE visible people with ${cast
            .map((c) => c.name)
            .join(' + ')} only; delete every other identity`
        : 'Prior still — REMOVE all people; keep room',
      role: 'base',
    });
    strategy = 'prior-frame';
  } else if (envUrls[0]) {
    queue.push({
      url: envUrls[0],
      label: `SET plate "${env?.name || 'set'}"`,
      role: 'base',
    });
    strategy = 'set-plate';
  }

  // Add cast likeness only if it's a DISTINCT url from base (true solo ref)
  if (wantsCast) {
    const baseKey = queue[0] ? urlKey(queue[0].url) : '';
    for (const c of cast) {
      const u = characterRefUrls(c)[0];
      if (!u) continue;
      if (urlKey(u) === baseKey) continue;
      // Skip shared multi-person plates as "likeness" — they cause identity swaps
      if (characterHasSharedPlate(project, c, env)) continue;
      queue.push({
        url: u,
        label: `Likeness ONLY for "${c.name}" — match this face/wardrobe; ignore any other people if present`,
        role: 'cast',
      });
    }
  }

  const urls: string[] = [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of queue) {
    if (!isPublicUrl(item.url)) continue;
    const key = urlKey(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(item.url);
    labels.push(item.label);
    if (urls.length >= MAX_CONTINUITY_REFS) break;
  }

  if (!urls.length) strategy = 'none';

  return {
    urls,
    labels,
    environment: env,
    cast,
    forbiddenCast,
    hasEnvPlate: envUrls.length > 0,
    hasCastPlate: cast.some((c) => characterRefUrls(c).length > 0),
    hasPriorFrame: !!anyPrior?.imageUrl,
    useEdit: urls.length > 0,
    baseUrl: urls[0],
    strategy,
    sharedPlateRisk,
  };
}

/**
 * Surgical edit prompt with HARD identity law:
 * selected cast only; every other project character is forbidden by name.
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
  const forbidden =
    bundle.forbiddenCast?.length > 0
      ? bundle.forbiddenCast
      : (project.characters || []).filter((c) => !(shot.characterIds || []).includes(c.id));
  const forbiddenNames = forbidden.map((c) => c.name).filter(Boolean);

  const identityLaw =
    n === 0
      ? 'IDENTITY LAW: No cast selected. ZERO people. Remove every person.'
      : n === 1
        ? `IDENTITY LAW (CRITICAL): The ONLY person allowed on screen is "${names[0]}". ` +
          `If Image 1 shows a different person, REPLACE them with "${names[0]}" using the likeness lock below — ` +
          `or remove them and place "${names[0]}" alone. ` +
          `Never leave the wrong character as the hero. Calling "${names[0]}" must show "${names[0]}", not a substitute.`
        : `IDENTITY LAW: The ONLY people allowed are ${names.join(' and ')}. ` +
          `Do not substitute, merge, or promote any other identity.`;

  const banList =
    forbiddenNames.length > 0
      ? `FORBIDDEN CHARACTERS (must not appear at all — not as hero, not as background): ${forbiddenNames.join(
          ', '
        )}. ` +
        `If any of these faces are in the source plate, delete them completely.`
      : 'Do not invent new named characters.';

  const castBlock =
    n === 0
      ? 'PEOPLE: Environment / set plate only.'
      : n === 1
        ? `PEOPLE: Exactly 1 person — "${names[0]}" only. No second figure. No crowd.`
        : `PEOPLE: Exactly ${n} persons — ${names.join(', ')} only.`;

  const likeness =
    n > 0
      ? cast
          .map((c) => {
            const bits = [
              `"${c.name}"`,
              c.role && `role:${c.role}`,
              c.subjectHint && `find them in plate as: ${c.subjectHint}`,
              c.faceNotes && `face:${c.faceNotes}`,
              c.wardrobe && `wardrobe:${c.wardrobe}`,
              c.silhouette && `build:${c.silhouette}`,
              c.description && `sheet:${c.description.slice(0, 180)}`,
              c.consistencyLock?.modelSheet && `lock:${c.consistencyLock.modelSheet.slice(0, 160)}`,
            ].filter(Boolean);
            return bits.join(' — ');
          })
          .join(' || ')
      : '';

  const env = bundle.environment;
  const setBlock = env
    ? `SET: "${env.name}" (${env.placeType}). Same architecture/furniture/colors. Camera may move; room may not.`
    : 'SET: Preserve room geometry from Image 1.';

  const imageRoles = bundle.labels
    .map((label, i) => `Image ${i + 1}: ${label}.`)
    .join(' ');

  const action = (shot.description || '').trim() || 'Continue the scene with a clear new beat.';
  const camera = (shot.camera || shot.cameraDetailed || 'Medium shot, clear subject').trim();
  const emotion = (shot.emotion || shot.actingCues || '').trim();
  const dialogue = (shot.dialogue || '').trim();

  const parts = [
    'SURGICAL IMAGE EDIT — series continuity. Edit source image(s); do not invent a new show.',
    imageRoles,
    identityLaw,
    banList,
    castBlock,
    setBlock,
    likeness ? `CALLED CAST LIKENESS (must match): ${likeness}.` : '',
    bundle.sharedPlateRisk
      ? 'NOTE: Cast may share one multi-person discover still. Use name + face/wardrobe/subject hint to pick the CORRECT person; never default to the most prominent face if they are not the called cast.'
      : '',
    `DELTA ONLY: camera (${camera}); action (${action})${emotion ? `; performance (${emotion})` : ''}${
      dialogue ? `; line ("${dialogue}")` : ''
    }.`,
    'FORBIDDEN: wrong-character swap, extra people, new furniture/props, logos, watermarks, celebrities.',
  ];

  return parts.filter(Boolean).join(' ');
}

/** @deprecated use buildStrictContinuityEditPrompt */
export function continuityEditPrefix(bundle: ContinuityRefBundle, shot: Shot): string {
  if (!bundle.urls.length) return '';
  return buildStrictContinuityEditPrompt(
    {
      characters: [...bundle.cast, ...(bundle.forbiddenCast || [])],
      environments: bundle.environment ? [bundle.environment] : [],
    } as Project,
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
