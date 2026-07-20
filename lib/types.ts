// Shared types for MovieDirector.ai
// Extracted for maintainability and future API use.

import type { CharacterMedium, VoiceAxes, VoiceVariant } from '@/lib/ensemble';

export type ProjectType = 'sitcom' | 'film' | 'commercial' | 'anime' | 'brand-fusion';

export type GenQuality = 'draft' | 'final';

export interface Shot {
  id: string;
  number: number;
  description: string;
  camera: string;
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  voiceoverScript?: string;
  characterIds?: string[];

  // Advanced cinematic controls
  emotion?: string;
  actingCues?: string;
  dialogue?: string;
  soundCues?: string;
  cameraDetailed?: string;
  styleNotes?: string;

  /**
   * Full freeform frame prompt. If set, replaces the auto-built prompt entirely
   * (master prefix / negative still wrap unless rawPrompt is true).
   */
  framePromptOverride?: string;
  /** Full freeform video prompt override */
  videoPromptOverride?: string;
  /** Edited copy of auto prompt the director locked in (still free to change) */
  lockedFramePrompt?: string;
  lockedVideoPrompt?: string;
  /** Skip master/negative wrap — pure prompt sent to Grok */
  rawPrompt?: boolean;
  lastFrameQuality?: GenQuality;
  lastVideoQuality?: GenQuality;
}

/**
 * How the director works this project:
 * - auto: minimal input (title + logline) → system builds treatment + shot list
 * - lab: full stations (world, script, prompts, direction, continuity)
 * Berserker is separate — it only changes creative intensity, not this mode.
 */
export type WorkflowMode = 'auto' | 'lab';

/** Project-level generation / prompt control (Concept Lab · Prompts station) */
export interface GenerationSettings {
  /** auto = minimal one-click build; lab = full pre-production control */
  workflowMode?: WorkflowMode;
  /** Default quality for generate buttons */
  defaultQuality?: GenQuality;
  /** Injected at the start of every auto-built prompt */
  masterPrompt?: string;
  /** Always appended after the shot prompt */
  promptSuffix?: string;
  /** Things the model must avoid */
  negativePrompt?: string;
  /** Default aspect ratio for frames */
  aspectRatio?: string;
  /** Director notes always present in gen prompts */
  directorNotes?: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  referenceImageUrl?: string;
  /** Visual medium for generation */
  medium?: CharacterMedium;
  silhouette?: string;
  palette?: string;
  wardrobe?: string;
  faceNotes?: string;
  signatureProp?: string;
  personality?: string;
  catchphrase?: string;
  /** Lab: what they want in this episode/film */
  objective?: string;
  /** Lab: how they change */
  arc?: string;
  /** Lab: director notes — how to play them */
  directionNotes?: string;
  /** Lab: relationship map (free text) */
  relationships?: string;
  voiceAxes?: VoiceAxes;
  voiceVariants?: VoiceVariant[];
  activeVoiceId?: string;
  tags?: string[];
}

export interface WorldBible {
  setting?: string;
  timePeriod?: string;
  tone?: string;
  themes?: string;
  audience?: string;
  visualLaws?: string;
  whatNever?: string;
  northStar?: string;
}

export interface ContinuityNotes {
  wardrobeRules?: string;
  locations?: string;
  props?: string;
  timeline?: string;
  doNotBreak?: string;
}

export interface StyleTemplate {
  description: string;
  referenceImageUrl?: string;
  /** Optional Style DNA pack id */
  dnaId?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  price: number;
  projectIds: string[];
  subscriberCount?: number;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  logline: string;
  concept?: string;
  synopsis?: string;
  style?: StyleTemplate;
  berserker: boolean;
  shots: Shot[];
  characters?: Character[];
  /** Full teleplay / master script (Concept Lab) */
  script?: string;
  /** Structured world bible (Concept Lab) */
  worldBible?: WorldBible;
  /** Continuity desk notes (Concept Lab) */
  continuity?: ContinuityNotes;
  /** Master prompt control + default quality (Concept Lab) */
  generationSettings?: GenerationSettings;
  isFirstCut?: boolean;
  firstCutPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedFilm {
  id: string;
  title: string;
  logline: string;
  creator?: string;
  creatorUsername?: string;
  creatorId?: string;
  likeCount?: number;
  commentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  publishedAt?: string;
  previewClip?: string;
  project?: { previewClip?: string; type?: string; clipCount?: number } | null;
}

export const PROJECT_TYPES: { value: ProjectType; label: string; desc: string }[] = [
  { value: 'sitcom', label: 'SITCOM EPISODE', desc: '22-min serialized episode. Characters. Punchlines. Heart.' },
  { value: 'film', label: 'SHORT FILM', desc: 'Cinematic short. Mood, tension, payoff.' },
  { value: 'commercial', label: 'COMMERCIAL', desc: '15-60s brand film. Sharp, emotional, memorable.' },
  { value: 'anime', label: 'ANIME SHORT', desc: 'Stylized. Expressive. Epic action or quiet beauty.' },
  { value: 'brand-fusion', label: 'BRAND FUSION', desc: 'Two brands. One story. Cultural collision.' },
];
