/**
 * Centralized prompt engineering for MovieDirector.ai
 * 
 * These functions encode the "professional director" brain.
 * They are used both by the UI and (future) public API.
 */

import type { ProjectType, Shot, Project } from './types';

export const DEFAULT_TREATMENTS: Record<
  ProjectType,
  (title: string, logline: string, berserker: boolean) => { synopsis: string; shots: Omit<Shot, 'id'>[] }
> = {
  sitcom: (title, logline, berserker) => ({
    synopsis: `${title} — ${logline}\n\nA tight 22-minute episode. Cold open gag, A-plot/B-plot collision, tag. Emotional turn at minute 14. Killer button at the end.`,
    shots: [
      { number: 1, description: "COLD OPEN — The inciting ridiculousness. Tight on character face, smash cut into chaos.", camera: "Close-up → Whip pan", duration: 18 },
      { number: 2, description: "TITLE CARD + THEME STING. The ensemble in absurd tableau.", camera: "Wide, locked off", duration: 6 },
      { number: 3, description: "A-plot launch. The main character gets the terrible idea.", camera: "Medium, tracking push-in", duration: 24 },
      { number: 4, description: "B-plot parallel. Side character’s minor disaster.", camera: "Over shoulder two-shot", duration: 16 },
      { number: 5, description: "Cross-cut escalation. Everything gets worse in both plots at once.", camera: "Rapid intercut", duration: 32 },
      { number: 6, description: "Heart moment. Two characters actually talk like humans for 8 seconds.", camera: "Intimate static", duration: 14 },
      { number: 7, description: "Climax convergence. All threads slam together in the living room / office / bar.", camera: "Low angle, circling", duration: 28 },
      { number: 8, description: "TAG. One last perfect dumb joke or surprisingly sweet button.", camera: "Single, tight", duration: 11 },
    ]
  }),

  film: (title, logline, berserker) => ({
    synopsis: `${title}\n\n${logline}\n\nA self-contained emotional machine. 6-12 minutes. No wasted frames. A decisive turn at 65%.`,
    shots: [
      { number: 1, description: "Opening image that contains the entire theme in metaphor.", camera: "Static wide or macro detail", duration: 14 },
      { number: 2, description: "World and character established with minimal dialogue.", camera: "Handheld, observant", duration: 26 },
      { number: 3, description: "The crack appears. Something is off. Subtle.", camera: "Slow dolly", duration: 19 },
      { number: 4, description: "The choice or event that cannot be undone.", camera: "Locked. Sudden push.", duration: 9 },
      { number: 5, description: "Consequences play out. The world reacts.", camera: "Long lens, distant", duration: 38 },
      { number: 6, description: "Climactic image. The character changed forever, shown not said.", camera: "Final wide or extreme close", duration: 22 },
    ]
  }),

  commercial: (title, logline, berserker) => ({
    synopsis: `${title} — ${logline}\n\n30-45 second brand film. One crystal clear idea. Emotional truth + product truth in the same breath. Ends on a sting.`,
    shots: [
      { number: 1, description: "Hook frame. A human truth or striking visual that stops scroll.", camera: "Bold close or impossible wide", duration: 4 },
      { number: 2, description: "The tension or desire. Real people, real stakes.", camera: "Naturalistic", duration: 9 },
      { number: 3, description: "The brand arrives as the elegant solution, never the hero.", camera: "Elegant product reveal", duration: 6 },
      { number: 4, description: "Emotional payoff. The after state feels better than before.", camera: "Soft light, human", duration: 7 },
      { number: 5, description: "Logo + final line. Clean. Confident. Unforgettable.", camera: "Centered lockup", duration: 4 },
    ]
  }),

  anime: (title, logline, berserker) => ({
    synopsis: `${title}\n${logline}\n\nStylized short. Exaggerated expressions. One breathtaking action or quiet transcendent moment. Strong color language.`,
    shots: [
      { number: 1, description: "Iconic establishing: neon city, floating temple, or rain-soaked alley.", camera: "Epic wide, slight crane", duration: 12 },
      { number: 2, description: "Hero silhouette or dramatic profile. Wind, hair, cape.", camera: "Low heroic angle", duration: 8 },
      { number: 3, description: "The spark. Eyes narrow. Power builds.", camera: "Extreme close on eyes", duration: 5 },
      { number: 4, description: "The clash or transformation. Pure visual poetry.", camera: "Dynamic, speed lines", duration: 18 },
      { number: 5, description: "Aftermath. Stillness. A single petal falls or a cigarette is lit.", camera: "Static, painterly", duration: 14 },
    ]
  }),

  'brand-fusion': (title, logline, berserker) => ({
    synopsis: `${title}\n\n${logline}\n\nTwo worlds. One story. The tension between them is the product. Funny, moving, or both. Never forced.`,
    shots: [
      { number: 1, description: "Two visual languages collide in the same frame.", camera: "Split composition or deep focus", duration: 11 },
      { number: 2, description: "Representatives of each brand meet. Friction + chemistry.", camera: "Two-shot, opposing eyelines", duration: 13 },
      { number: 3, description: "The absurd beautiful middle ground. The fusion moment.", camera: "Symmetrical hero frame", duration: 9 },
      { number: 4, description: "Cultural payoff. The combined thing feels inevitable.", camera: "Slow push to product", duration: 12 },
      { number: 5, description: "Final title card. Both logos. One new world.", camera: "Clean lockup", duration: 5 },
    ]
  }),
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

export function generateFramePrompt(project: Project, shot: Shot): string {
  if (!project) return '';

  const projectConcept = project.concept ? `Overall project: ${project.concept}. ` : '';
  const styleRef = project.style?.description ? `Style: ${project.style.description}. ` : '';

  let base = `${projectConcept}${styleRef}Key still #${shot.number} from original series "${project.title}". ${shot.description}. Framing: ${shot.camera}.`;

  if (shot.cameraDetailed) base += ` Camera direction: ${shot.cameraDetailed}.`;
  if (shot.emotion) base += ` Performance: ${shot.emotion}.`;
  if (shot.actingCues) base += ` Acting: ${shot.actingCues}.`;
  if (shot.dialogue) base += ` Dialogue: "${shot.dialogue}".`;
  if (shot.soundCues) base += ` Sound design note: ${shot.soundCues}.`;
  if (shot.styleNotes) base += ` Additional style: ${shot.styleNotes}.`;

  const chars = (project.characters || []).filter(c => shot.characterIds?.includes(c.id));
  if (chars.length) {
    base += ` ORIGINAL characters only (maintain exact likeness from references): ${chars.map(characterPromptBlock).join(' | ')}. `;
  }

  // If style DNA describes limited animation / stylized, don't force photoreal
  const stylized =
    !!project.style?.dnaId ||
    /limited-animation|cartoon|anime|claymation|2D|3D toon|pixel/i.test(project.style?.description || '');

  const quality = project.berserker
    ? 'Unrestrained visual imagination, intense design language, one consistent original world. Master director frame.'
    : stylized
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

  const projectConcept = project.concept ? `Project vision: ${project.concept}. ` : '';
  const styleRef = project.style?.description ? `Style reference: ${project.style.description}. ` : '';

  let prompt = `${projectConcept}${styleRef}Animate into a professional ${shot.duration}s clip for original series "${project.title}". `;

  prompt += `Action & intent: ${shot.description}. Camera: ${shot.camera}. `;

  if (shot.cameraDetailed) prompt += `Precise camera work: ${shot.cameraDetailed}. `;
  if (shot.emotion) prompt += `Emotion & performance: ${shot.emotion}. `;
  if (shot.actingCues) prompt += `Micro acting: ${shot.actingCues}. `;
  if (shot.dialogue) prompt += `Lip-synced dialogue delivery: "${shot.dialogue}". `;
  if (shot.soundCues) prompt += `Native audio & sound design: ${shot.soundCues}. `;
  if (shot.styleNotes) prompt += `Style notes: ${shot.styleNotes}. `;

  const chars = (project.characters || []).filter(c => shot.characterIds?.includes(c.id));
  if (chars.length > 0) {
    prompt += `Maintain absolute character consistency with reference images: ${chars.map(characterPromptBlock).join(' | ')}. `;
    // Voice direction from active voice variants
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
  }

  const stylized =
    !!project.style?.dnaId ||
    /limited-animation|cartoon|anime|claymation|2D|3D toon|pixel/i.test(project.style?.description || '');

  prompt += project.berserker
    ? 'Bold unrestrained motion matching Style DNA. '
    : stylized
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
  return [
    `Highly consistent original character reference for "${character.name}", ${character.role} in "${project.title}".`,
    character.description,
    character.medium && `Medium: ${character.medium}.`,
    character.silhouette && `Silhouette: ${character.silhouette}.`,
    character.faceNotes && `Face: ${character.faceNotes}.`,
    character.wardrobe && `Wardrobe: ${character.wardrobe}.`,
    character.palette && `Palette: ${character.palette}.`,
    character.personality && `Personality energy: ${character.personality}.`,
    project.style?.description && `Match project Style DNA: ${project.style.description.slice(0, 280)}.`,
    'Model-sheet quality three-quarter portrait, repeatable across all shots. Not any existing copyrighted character.',
  ]
    .filter(Boolean)
    .join(' ');
}
