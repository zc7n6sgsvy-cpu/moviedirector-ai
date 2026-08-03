/**
 * Scene reference assembly for Grok Imagine Video 1.5
 * — up to 7 image refs + preset voice ids for locked cast/set continuity.
 */

import type { Character, Project, Shot } from '@/lib/types';
import { MAX_VIDEO_REFERENCE_IMAGES, MAX_VIDEO_REFERENCE_VOICES } from '@/lib/xai';
import { characterRefUrls, environmentRefUrls, resolveShotEnvironment } from '@/lib/continuity-refs';
import { isTransitionShot } from '@/lib/transitions';

const HTTPS = /^https?:\/\//i;

function isPublic(u: unknown): u is string {
  return typeof u === 'string' && HTTPS.test(u) && !u.includes('picsum.photos');
}

export type SceneRefBundle = {
  /** Ordered image URLs for reference_images (max 7) */
  imageUrls: string[];
  /** Labels for prompt: Image 1 = … */
  imageLabels: string[];
  /** Preset voice_ids for reference_audios (max 3) */
  voiceIds: string[];
  /** Prompt fragments naming <IMAGE_n> / <AUDIO_n> */
  promptLockBlock: string;
  modeHint: 'image-to-video' | 'reference-to-video' | 'text-to-video';
};

/**
 * Collect visual + voice locks for a shot.
 * Prefer: prior shot frame → env plate → cast solo plates (up to 7 total).
 */
export function collectSceneRefsForVideo(project: Project, shot: Shot): SceneRefBundle {
  type Labeled = { url: string; label: string };
  const queue: Labeled[] = [];

  const env = resolveShotEnvironment(project, shot);
  const cast = (project.characters || []).filter((c) =>
    (shot.characterIds || []).includes(c.id)
  );

  // Prior story frame for narrative continuity (next-shot lock)
  if (!isTransitionShot(shot)) {
    const prev = (project.shots || [])
      .filter(
        (s) =>
          !isTransitionShot(s) &&
          s.id !== shot.id &&
          (s.number || 0) < (shot.number || 0) &&
          isPublic(s.imageUrl)
      )
      .sort((a, b) => (b.number || 0) - (a.number || 0))[0];
    if (prev?.imageUrl) {
      queue.push({
        url: prev.imageUrl,
        label: `PRIOR SHOT #${prev.number} continuity plate — match world, lighting continuity`,
      });
    }
  }

  for (const u of environmentRefUrls(env)) {
    queue.push({
      url: u,
      label: `LOCKED SET "${env?.name || 'location'}"`,
    });
  }

  for (const c of cast) {
    for (const u of characterVisualUrls(c)) {
      queue.push({
        url: u,
        label: `LOCKED CHARACTER "${c.name}" visual`,
      });
    }
  }

  // Style DNA last
  if (isPublic(project.style?.referenceImageUrl)) {
    queue.push({
      url: project.style!.referenceImageUrl!,
      label: 'Style DNA plate',
    });
  }

  const imageUrls: string[] = [];
  const imageLabels: string[] = [];
  const seen = new Set<string>();
  for (const item of queue) {
    if (!isPublic(item.url)) continue;
    const key = item.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    imageUrls.push(item.url);
    imageLabels.push(item.label);
    if (imageUrls.length >= MAX_VIDEO_REFERENCE_IMAGES) break;
  }

  const voiceIds: string[] = [];
  for (const c of cast) {
    const vid = (c.ttsVoiceId || c.voiceProfile?.presetVoiceId || '').trim().toLowerCase();
    if (vid && !voiceIds.includes(vid)) voiceIds.push(vid);
    if (voiceIds.length >= MAX_VIDEO_REFERENCE_VOICES) break;
  }

  const imageLines = imageLabels.map(
    (lab, i) => `<IMAGE_${i + 1}> is ${lab}. Match identity/look from this reference.`
  );
  const audioLines = voiceIds.map(
    (v, i) =>
      `<AUDIO_${i}> is the locked speaking voice for cast member ${i + 1} (preset ${v}). Use for dialogue.`
  );
  const voiceProfileLines = cast
    .map((c) => {
      const vp = c.voiceProfile;
      if (!vp && !c.personality) return null;
      return (
        `${c.name} voice profile: ` +
        [
          vp?.tone || c.personality,
          vp?.speechPatterns,
          vp?.reactionStyle,
          vp?.energy,
        ]
          .filter(Boolean)
          .join('; ')
      );
    })
    .filter(Boolean) as string[];

  const promptLockBlock = [
    imageLines.length ? 'VISUAL LOCKS:' : '',
    ...imageLines,
    audioLines.length ? 'VOICE LOCKS:' : '',
    ...audioLines,
    voiceProfileLines.length ? `PERFORMANCE: ${voiceProfileLines.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  let modeHint: SceneRefBundle['modeHint'] = 'text-to-video';
  if (shot.imageUrl && isPublic(shot.imageUrl)) modeHint = 'image-to-video';
  else if (imageUrls.length) modeHint = 'reference-to-video';

  return { imageUrls, imageLabels, voiceIds, promptLockBlock, modeHint };
}

function characterVisualUrls(c: Character): string[] {
  const fromLock = c.consistencyLock?.referenceUrls || [];
  const multi = c.visualReferenceUrls || [];
  return [c.referenceImageUrl || '', ...multi, ...fromLock].filter(isPublic);
}

/**
 * When shot has a still: i2v from that still (composition lock).
 * Else: multi-ref reference-to-video with cast/set plates.
 */
export function resolveVideoModeAndPayload(
  project: Project,
  shot: Shot
): {
  mode: 'image-to-video' | 'reference-to-video' | 'text-to-video';
  imageUrl?: string;
  referenceImageUrls?: string[];
  referenceVoiceIds?: string[];
  promptSuffix: string;
} {
  const bundle = collectSceneRefsForVideo(project, shot);
  if (shot.imageUrl && isPublic(shot.imageUrl)) {
    return {
      mode: 'image-to-video',
      imageUrl: shot.imageUrl,
      // Voices only work on reference path; bake performance into prompt for i2v
      promptSuffix: [
        bundle.promptLockBlock,
        castVoicePromptFallback(project, shot),
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  if (bundle.imageUrls.length) {
    return {
      mode: 'reference-to-video',
      referenceImageUrls: bundle.imageUrls,
      referenceVoiceIds: bundle.voiceIds,
      promptSuffix: bundle.promptLockBlock,
    };
  }
  return {
    mode: 'text-to-video',
    promptSuffix: castVoicePromptFallback(project, shot),
  };
}

function castVoicePromptFallback(project: Project, shot: Shot): string {
  const cast = (project.characters || []).filter((c) =>
    (shot.characterIds || []).includes(c.id)
  );
  if (!cast.length) return '';
  return (
    'VOICE/PERFORMANCE: ' +
    cast
      .map((c) => {
        const vp = c.voiceProfile;
        return `${c.name}: ${[
          vp?.tone || c.personality,
          vp?.speechPatterns,
          c.ttsVoiceId && `tts:${c.ttsVoiceId}`,
        ]
          .filter(Boolean)
          .join(', ')}`;
      })
      .join(' | ')
  );
}
