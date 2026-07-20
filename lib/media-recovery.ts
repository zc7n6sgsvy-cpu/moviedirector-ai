/**
 * Media recovery helpers — hard refresh / API overwrite can drop frames & clips
 * from the UI even when URLs still live in Blob, jobs, or localStorage.
 */

import type { Project, Shot } from '@/lib/types';

export type RecoveredAsset = {
  imageUrl?: string;
  videoUrl?: string;
  projectId?: string;
  projectTitle?: string;
  shotId?: string;
  shotNumber?: number;
  description?: string;
  source: 'local' | 'project' | 'job' | 'blob';
};

export function isHttpMediaUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('/generated/')) return true; // local demo assets
  return /^https?:\/\//i.test(url);
}

export function projectHasMedia(p: Project): boolean {
  return (p.shots || []).some((s) => isHttpMediaUrl(s.imageUrl) || isHttpMediaUrl(s.videoUrl));
}

/** Prefer non-empty media fields from local when API is missing them. */
export function mergeShotsPreferMedia(apiShots: Shot[] = [], localShots: Shot[] = []): Shot[] {
  const localById = new Map(localShots.map((s) => [s.id, s]));
  const usedLocal = new Set<string>();

  const merged = apiShots.map((api) => {
    const local = localById.get(api.id);
    if (!local) return api;
    usedLocal.add(api.id);
    return {
      ...api,
      ...local,
      // API wins on structural fields if present; media prefers whichever has URL
      description: api.description || local.description,
      camera: api.camera || local.camera,
      imageUrl: isHttpMediaUrl(api.imageUrl) ? api.imageUrl : local.imageUrl || api.imageUrl,
      videoUrl: isHttpMediaUrl(api.videoUrl) ? api.videoUrl : local.videoUrl || api.videoUrl,
      dialogue: api.dialogue ?? local.dialogue,
      emotion: api.emotion ?? local.emotion,
      actingCues: api.actingCues ?? local.actingCues,
      characterIds: api.characterIds?.length ? api.characterIds : local.characterIds,
    };
  });

  // Keep orphan local shots that still have media (renumber later if needed)
  for (const local of localShots) {
    if (usedLocal.has(local.id)) continue;
    if (isHttpMediaUrl(local.imageUrl) || isHttpMediaUrl(local.videoUrl)) {
      merged.push(local);
    }
  }

  return merged.map((s, i) => ({ ...s, number: i + 1 }));
}

export function mergeProjectsPreferMedia(apiProjects: Project[], localProjects: Project[]): Project[] {
  const localById = new Map(localProjects.map((p) => [p.id, p]));
  const seen = new Set<string>();

  const merged = apiProjects.map((api) => {
    seen.add(api.id);
    const local = localById.get(api.id);
    if (!local) return api;
    return {
      ...api,
      // Prefer longer lab text from either side
      script: (api.script?.length || 0) >= (local.script?.length || 0) ? api.script : local.script,
      concept: api.concept || local.concept,
      synopsis: api.synopsis || local.synopsis,
      worldBible: api.worldBible || local.worldBible,
      continuity: api.continuity || local.continuity,
      generationSettings: api.generationSettings || local.generationSettings,
      characters: (api.characters?.length || 0) >= (local.characters?.length || 0) ? api.characters : local.characters,
      shots: mergeShotsPreferMedia(api.shots, local.shots),
      updatedAt: new Date().toISOString(),
    };
  });

  // Local-only projects that still have media (e.g. demo gens) → keep
  for (const local of localProjects) {
    if (seen.has(local.id)) continue;
    if (projectHasMedia(local)) {
      merged.unshift({
        ...local,
        title: local.title?.includes('[LOCAL]') ? local.title : `${local.title} [LOCAL RECOVERY]`,
      });
    }
  }

  return merged;
}

export function extractAssetsFromProjects(projects: Project[], source: RecoveredAsset['source'] = 'project'): RecoveredAsset[] {
  const out: RecoveredAsset[] = [];
  for (const p of projects) {
    for (const s of p.shots || []) {
      if (!isHttpMediaUrl(s.imageUrl) && !isHttpMediaUrl(s.videoUrl)) continue;
      out.push({
        imageUrl: isHttpMediaUrl(s.imageUrl) ? s.imageUrl : undefined,
        videoUrl: isHttpMediaUrl(s.videoUrl) ? s.videoUrl : undefined,
        projectId: p.id,
        projectTitle: p.title,
        shotId: s.id,
        shotNumber: s.number,
        description: s.description,
        source,
      });
    }
  }
  return out;
}

export function dedupeAssets(assets: RecoveredAsset[]): RecoveredAsset[] {
  const seen = new Set<string>();
  const out: RecoveredAsset[] = [];
  for (const a of assets) {
    const key = `${a.videoUrl || ''}|${a.imageUrl || ''}`;
    if (!key || key === '|') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export function assetsToShots(assets: RecoveredAsset[]): Omit<Shot, 'id'>[] {
  return assets.map((a, i) => ({
    number: i + 1,
    description:
      a.description ||
      `Recovered ${a.videoUrl ? 'clip' : 'frame'} from ${a.source}${a.projectTitle ? ` · ${a.projectTitle}` : ''}${
        a.shotNumber ? ` · shot ${a.shotNumber}` : ''
      }`,
    camera: 'Recovered asset',
    duration: a.videoUrl ? 8 : 3,
    imageUrl: a.imageUrl,
    videoUrl: a.videoUrl,
  }));
}
