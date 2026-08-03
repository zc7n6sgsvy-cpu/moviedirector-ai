/**
 * Calibration Engine — post-sequence continuity scan.
 *
 * Text/vision-assisted flags on the timeline. User previews fixes; we never
 * auto-overwrite media. Additive to the director OS.
 */

import type { Project, Shot } from '@/lib/types';
import { isTransitionShot } from '@/lib/transitions';

export type CalibrationSeverity = 'info' | 'warn' | 'critical';

export type CalibrationIssueKind =
  | 'position-jump'
  | 'energy-mismatch'
  | 'dialogue-voice'
  | 'behavior'
  | 'environment-lighting'
  | 'cast-swap'
  | 'duration'
  | 'missing-media';

export type CalibrationIssue = {
  id: string;
  shotId: string;
  shotNumber: number;
  /** Optional pair for A→B continuity */
  relatedShotId?: string;
  kind: CalibrationIssueKind;
  severity: CalibrationSeverity;
  title: string;
  detail: string;
  /** Suggested fix brief for image-edit / re-gen */
  fixBrief: string;
  rangeHint?: { startSec?: number; endSec?: number };
};

export type CalibrationReport = {
  scannedAt: string;
  issueCount: number;
  issues: CalibrationIssue[];
  summary: string;
};

function storyShots(project: Project): Shot[] {
  return (project.shots || [])
    .filter((s) => !isTransitionShot(s))
    .sort((a, b) => (a.number || 0) - (b.number || 0));
}

/**
 * Deterministic structural scan (no API cost).
 * Complements later vision pass for deeper checks.
 */
export function scanSequenceStructural(project: Project): CalibrationReport {
  const shots = storyShots(project);
  const issues: CalibrationIssue[] = [];
  const castMap = new Map((project.characters || []).map((c) => [c.id, c.name]));

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const prev = i > 0 ? shots[i - 1] : undefined;

    if (!s.imageUrl && !s.videoUrl) {
      issues.push({
        id: `miss-${s.id}`,
        shotId: s.id,
        shotNumber: s.number,
        kind: 'missing-media',
        severity: 'warn',
        title: `Shot #${s.number} has no frame or clip`,
        detail: 'Empty beat — generate media or mark as intentional hold.',
        fixBrief: `Generate a frame for shot #${s.number}: ${s.description}`,
      });
    }

    if (s.duration && (s.duration < 1 || s.duration > 15)) {
      issues.push({
        id: `dur-${s.id}`,
        shotId: s.id,
        shotNumber: s.number,
        kind: 'duration',
        severity: 'info',
        title: `Shot #${s.number} duration ${s.duration}s is outside 1–15s Grok range`,
        detail: 'Clamp for generation or split the beat.',
        fixBrief: `Set duration between 1 and 15 seconds for shot #${s.number}.`,
        rangeHint: { startSec: 0, endSec: s.duration },
      });
    }

    if (prev) {
      // Environment flip without bridge
      const envA = prev.environmentId || project.defaultEnvironmentId;
      const envB = s.environmentId || project.defaultEnvironmentId;
      if (envA && envB && envA !== envB && !s.isTransition) {
        const hasBridge = (project.shots || []).some(
          (t) =>
            isTransitionShot(t) &&
            t.bridgeFromShotId === prev.id &&
            t.bridgeToShotId === s.id
        );
        if (!hasBridge) {
          issues.push({
            id: `env-${prev.id}-${s.id}`,
            shotId: s.id,
            shotNumber: s.number,
            relatedShotId: prev.id,
            kind: 'environment-lighting',
            severity: 'warn',
            title: `Location jump #${prev.number} → #${s.number} without bridge`,
            detail: 'Different locked sets back-to-back can feel like a teleport.',
            fixBrief: `Add a continuity bridge between shots #${prev.number} and #${s.number}, or match environmentId.`,
          });
        }
      }

      // Cast identity thrash
      const a = new Set(prev.characterIds || []);
      const b = new Set(s.characterIds || []);
      const dropped = [...a].filter((id) => !b.has(id));
      const added = [...b].filter((id) => !a.has(id));
      if (dropped.length && added.length && a.size === 1 && b.size === 1) {
        issues.push({
          id: `cast-${prev.id}-${s.id}`,
          shotId: s.id,
          shotNumber: s.number,
          relatedShotId: prev.id,
          kind: 'cast-swap',
          severity: 'critical',
          title: `Possible cast swap #${prev.number} → #${s.number}`,
          detail: `Was ${dropped.map((id) => castMap.get(id) || id).join(', ')}; now ${added
            .map((id) => castMap.get(id) || id)
            .join(', ')}. Confirm intentional cutaway.`,
          fixBrief: `Either restore cast on shot #${s.number} to match #${prev.number}, or insert a clear cutaway beat.`,
        });
      }

      // Energy / emotion mismatch (heuristic)
      const e1 = (prev.emotion || '').toLowerCase();
      const e2 = (s.emotion || '').toLowerCase();
      const hot = /rage|panic|scream|chaos|berserk|explode/;
      const cold = /calm|still|whisper|quiet|meditat/;
      if (e1 && e2 && hot.test(e1) && cold.test(e2) && (s.duration || 0) <= 3) {
        issues.push({
          id: `energy-${prev.id}-${s.id}`,
          shotId: s.id,
          shotNumber: s.number,
          relatedShotId: prev.id,
          kind: 'energy-mismatch',
          severity: 'info',
          title: `Energy drop #${prev.number} → #${s.number} is abrupt`,
          detail: `From "${prev.emotion}" to "${s.emotion}" in a short beat.`,
          fixBrief: `Lengthen shot #${s.number} or add a bridge reaction shot for emotional continuity.`,
        });
      }

      // Dialogue without voice profile / VO
      if (s.dialogue?.trim() && !(s.voiceAudioUrl || s.voiceoverScript)) {
        const cast = (s.characterIds || [])
          .map((id) => (project.characters || []).find((c) => c.id === id))
          .filter(Boolean);
        const noVoice = cast.filter((c) => !c!.ttsVoiceId && !c!.voiceProfile);
        if (noVoice.length) {
          issues.push({
            id: `dlg-${s.id}`,
            shotId: s.id,
            shotNumber: s.number,
            kind: 'dialogue-voice',
            severity: 'info',
            title: `Dialogue on #${s.number} without locked voice`,
            detail: `${noVoice.map((c) => c!.name).join(', ')} lack TTS/voice profile — lip-sync may invent a voice.`,
            fixBrief: `Assign ttsVoiceId / voice profile on CAST LOCK for ${noVoice
              .map((c) => c!.name)
              .join(', ')}, then regen video.`,
          });
        }
      }

      // Position jump: same cast+set but camera extreme flip without notes
      if (
        envA === envB &&
        JSON.stringify([...(prev.characterIds || [])].sort()) ===
          JSON.stringify([...(s.characterIds || [])].sort()) &&
        prev.camera &&
        s.camera
      ) {
        const wide = /wide|establishing|aerial|drone/i;
        const ecu = /extreme close|ecu|macro/i;
        if (
          (wide.test(prev.camera) && ecu.test(s.camera)) ||
          (ecu.test(prev.camera) && wide.test(s.camera))
        ) {
          issues.push({
            id: `pos-${prev.id}-${s.id}`,
            shotId: s.id,
            shotNumber: s.number,
            relatedShotId: prev.id,
            kind: 'position-jump',
            severity: 'info',
            title: `Camera scale jump #${prev.number} → #${s.number}`,
            detail: `${prev.camera} → ${s.camera}. May read as a position jump without a bridging medium shot.`,
            fixBrief: `Insert a medium shot between #${prev.number} and #${s.number}, or soften camera language.`,
          });
        }
      }
    }

    // Behavior: dialogue claims action that fights description (lightweight)
    if (s.dialogue && s.description) {
      const d = s.dialogue.toLowerCase();
      const desc = s.description.toLowerCase();
      if (/run|sprint|flee/.test(d) && /sit|seated|lying|asleep/.test(desc)) {
        issues.push({
          id: `beh-${s.id}`,
          shotId: s.id,
          shotNumber: s.number,
          kind: 'behavior',
          severity: 'warn',
          title: `Action vs dialogue mismatch on #${s.number}`,
          detail: 'Dialogue implies motion that description does not support.',
          fixBrief: `Align description and dialogue on shot #${s.number}, or split into two beats.`,
        });
      }
    }
  }

  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const summary =
    issues.length === 0
      ? 'Sequence looks structurally coherent. Optional: run a vision pass later for lighting/face checks.'
      : `Found ${issues.length} flag(s): ${critical} critical, ${warns} warnings. Review timeline marks — you choose what to fix.`;

  return {
    scannedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
    summary,
  };
}

/** Prompt for a user-approved fix gen (still or video). */
export function buildCalibrationFixPrompt(
  project: Project,
  issue: CalibrationIssue,
  shot: Shot
): string {
  return [
    `CALIBRATION FIX for series "${project.title}".`,
    `Issue: ${issue.title}. ${issue.detail}`,
    `Director fix brief: ${issue.fixBrief}`,
    `Shot #${shot.number}: ${shot.description}`,
    shot.camera && `Camera: ${shot.camera}.`,
    shot.dialogue && `Dialogue: "${shot.dialogue}".`,
    'Preserve locked cast faces, wardrobe, and environment plates. Surgical continuity edit — do not invent a new world.',
  ]
    .filter(Boolean)
    .join(' ');
}
