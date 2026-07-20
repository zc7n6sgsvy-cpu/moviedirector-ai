/**
 * Centralized prompt engineering for MovieDirector.ai
 *
 * Professional director brain + Berserker (signature myth mode).
 */

import type { ProjectType, Shot, Project } from './types';
import {
  berserkerTreatment,
  standardTreatment,
  berserkerFrameBoost,
  berserkerVideoBoost,
  berserkerCharacterBoost,
  berserkerStyleOverlay,
  berserkerVoiceTone,
  berserkerCameraCurse,
} from '@/lib/berserker';
import {
  composeConceptFromLab,
  applyCharacterDirectionToPrompt,
} from '@/lib/concept-lab';

export const DEFAULT_TREATMENTS: Record<
  ProjectType,
  (title: string, logline: string, berserker: boolean) => { synopsis: string; shots: Omit<Shot, 'id'>[] }
> = {
  sitcom: (title, logline, berserker) =>
    berserker ? berserkerTreatment('sitcom', title, logline) : standardTreatment('sitcom', title, logline),
  film: (title, logline, berserker) =>
    berserker ? berserkerTreatment('film', title, logline) : standardTreatment('film', title, logline),
  commercial: (title, logline, berserker) =>
    berserker ? berserkerTreatment('commercial', title, logline) : standardTreatment('commercial', title, logline),
  anime: (title, logline, berserker) =>
    berserker ? berserkerTreatment('anime', title, logline) : standardTreatment('anime', title, logline),
  'brand-fusion': (title, logline, berserker) =>
    berserker
      ? berserkerTreatment('brand-fusion', title, logline)
      : standardTreatment('brand-fusion', title, logline),
};

function characterPromptBlock(c: {
  name: string;
  role: string;
  description: string;
  medium?: string;
  silhouette?: string;
  wardrobe?: string;
  palette?: string;
  faceNotes?: string;
  personality?: string;
}): string {
  return [
    `${c.name} (${c.role})`,
    c.description,
    c.medium && `medium:${c.medium}`,
    c.silhouette && `silhouette:${c.silhouette}`,
    c.faceNotes && `face:${c.faceNotes}`,
    c.wardrobe && `wardrobe:${c.wardrobe}`,
    c.palette && `palette:${c.palette}`,
    c.personality && `personality:${c.personality}`,
  ]
    .filter(Boolean)
    .join(' — ');
}

function isStylized(project: Project): boolean {
  return (
    !!project.style?.dnaId ||
    /limited-animation|cartoon|anime|claymation|2D|3D toon|pixel|berserker/i.test(
      project.style?.description || ''
    )
  );
}

export function generateFramePrompt(project: Project, shot: Shot): string {
  if (!project) return '';

  const styleDesc = project.berserker
    ? berserkerStyleOverlay(project.style?.description)
    : project.style?.description;

  const labConcept = composeConceptFromLab(project.concept, project.worldBible, project.continuity);
  const projectConcept = labConcept ? `Overall project / lab bible: ${labConcept}. ` : '';
  const styleRef = styleDesc ? `Style: ${styleDesc}. ` : '';
  const castDirection = applyCharacterDirectionToPrompt(project);
  const directionRef = castDirection ? `Character direction (lab): ${castDirection}. ` : '';

  let base = `${projectConcept}${styleRef}${directionRef}Key still #${shot.number} from original series "${project.title}". ${shot.description}. Framing: ${shot.camera}.`;

  if (shot.cameraDetailed) base += ` Camera direction: ${shot.cameraDetailed}.`;
  else if (project.berserker) {
    base += ` Camera direction: ${berserkerCameraCurse(project.title, shot.number)}.`;
  }
  if (shot.emotion) base += ` Performance: ${shot.emotion}.`;
  if (shot.actingCues) base += ` Acting: ${shot.actingCues}.`;
  if (shot.dialogue) base += ` Dialogue (script control): "${shot.dialogue}".`;
  if (shot.soundCues) base += ` Sound design note: ${shot.soundCues}.`;
  if (shot.styleNotes) base += ` Additional style: ${shot.styleNotes}.`;

  const chars = (project.characters || []).filter((c) => shot.characterIds?.includes(c.id));
  if (chars.length) {
    base += ` ORIGINAL characters only (maintain exact likeness from references): ${chars
      .map((c) => {
        const dir = [c.objective && `wants:${c.objective}`, c.directionNotes && `play:${c.directionNotes}`]
          .filter(Boolean)
          .join(', ');
        return `${characterPromptBlock(c)}${dir ? ` [${dir}]` : ''}`;
      })
      .join(' | ')}. `;
  }

  if (project.berserker) {
    return `${base} ${berserkerFrameBoost(project.title, shot.number)} Ultra high resolution. No copyrighted characters.`;
  }

  const quality = isStylized(project)
    ? 'Stay faithful to the project Style DNA and medium — not photoreal unless style says so. Perfect model-sheet consistency, readable silhouettes, one coherent original world.'
    : 'Photorealistic or stylized matching the project tone. Beautiful natural lighting. Film grain, precise composition, one consistent world.';

  const typeFlavor = {
    sitcom: 'Sitcom storytelling clarity with emotional truth and joke architecture.',
    film: 'Dramatic, emotional, precise heroic composition.',
    commercial: 'Polished advertising perfection with brand soul.',
    anime: 'Gorgeous stylized anime key art. Dynamic and expressive.',
    'brand-fusion': 'Two visual languages perfectly fused into one coherent world.',
  }[project.type];

  return `${base} ${quality} ${typeFlavor} Ultra high resolution, masterpiece frame, coherent original world. No copyrighted characters.`;
}

export function generateVideoPrompt(project: Project, shot: Shot): string {
  if (!project) return '';

  const styleDesc = project.berserker
    ? berserkerStyleOverlay(project.style?.description)
    : project.style?.description;

  const labConcept = composeConceptFromLab(project.concept, project.worldBible, project.continuity);
  const projectConcept = labConcept ? `Project vision / lab: ${labConcept}. ` : '';
  const styleRef = styleDesc ? `Style reference: ${styleDesc}. ` : '';
  const castDirection = applyCharacterDirectionToPrompt(project);

  let prompt = `${projectConcept}${styleRef}Animate into a professional ${shot.duration}s clip for original series "${project.title}". `;
  if (castDirection) prompt += `Character direction from lab: ${castDirection}. `;

  prompt += `Action & intent: ${shot.description}. Camera: ${shot.camera}. `;

  if (shot.cameraDetailed) prompt += `Precise camera work: ${shot.cameraDetailed}. `;
  else if (project.berserker) {
    prompt += `Camera curse: ${berserkerCameraCurse(project.title, shot.number)}. `;
  }
  if (shot.emotion) prompt += `Emotion & performance: ${shot.emotion}. `;
  if (shot.actingCues) prompt += `Micro acting: ${shot.actingCues}. `;
  if (shot.dialogue) prompt += `Lip-synced dialogue from script control: "${shot.dialogue}". `;
  if (shot.soundCues) prompt += `Native audio & sound design: ${shot.soundCues}. `;
  if (shot.styleNotes) prompt += `Style notes: ${shot.styleNotes}. `;

  const chars = (project.characters || []).filter((c) => shot.characterIds?.includes(c.id));
  if (chars.length > 0) {
    prompt += `Maintain absolute character consistency with reference images: ${chars
      .map((c) => {
        const dir = [c.objective && `objective:${c.objective}`, c.directionNotes && `direction:${c.directionNotes}`]
          .filter(Boolean)
          .join(', ');
        return `${characterPromptBlock(c)}${dir ? ` (${dir})` : ''}`;
      })
      .join(' | ')}. `;
    const voiceBits = chars
      .map((c) => {
        const variants = c.voiceVariants || [];
        const active = variants.find((v) => v.id === c.activeVoiceId) || variants[0];
        return active ? `${c.name}: ${active.promptSnippet}` : null;
      })
      .filter(Boolean);
    if (voiceBits.length) {
      prompt += `Original voice performance direction (never imitate celebrities or other shows): ${voiceBits.join(' ')} `;
    }
    if (project.berserker) {
      prompt += `${berserkerVoiceTone()} `;
    }
  } else if (project.berserker) {
    prompt += `${berserkerVoiceTone()} `;
  }

  if (project.berserker) {
    prompt += berserkerVideoBoost(project.title, shot.number);
    prompt += ' Coherent summoned world. Native audio with lip sync. No copyrighted characters.';
    return prompt;
  }

  prompt += isStylized(project)
    ? 'Motion grammar matches Style DNA (limited animation or medium-true motion — not default photoreal). '
    : 'Elegant purposeful motion, realistic physics, subtle life. ';
  prompt += 'Coherent original world across shots. Native audio with lip sync. No copyrighted characters.';

  return prompt;
}

export function generateCharacterRefPrompt(
  project: Project,
  character: {
    name: string;
    role: string;
    description: string;
    medium?: string;
    silhouette?: string;
    wardrobe?: string;
    palette?: string;
    faceNotes?: string;
    personality?: string;
  }
) {
  const parts = [
    `Highly consistent original character reference for "${character.name}", ${character.role} in "${project.title}".`,
    character.description,
    character.medium && `Medium: ${character.medium}.`,
    character.silhouette && `Silhouette: ${character.silhouette}.`,
    character.faceNotes && `Face: ${character.faceNotes}.`,
    character.wardrobe && `Wardrobe: ${character.wardrobe}.`,
    character.palette && `Palette: ${character.palette}.`,
    character.personality && `Personality energy: ${character.personality}.`,
    project.style?.description &&
      `Match project Style DNA: ${
        project.berserker
          ? berserkerStyleOverlay(project.style.description).slice(0, 320)
          : project.style.description.slice(0, 280)
      }.`,
    project.berserker
      ? berserkerCharacterBoost(character.name)
      : 'Model-sheet quality three-quarter portrait, repeatable across all shots. Not any existing copyrighted character.',
  ];

  return parts.filter(Boolean).join(' ');
}

/** Voiceover / VO line prompt flavor */
export function generateVoiceoverPromptTone(berserker: boolean): string {
  return berserker ? berserkerVoiceTone() : 'precise, cinematic, clear diction, subtle emotion';
}
