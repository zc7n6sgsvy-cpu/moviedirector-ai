// Shared types for MovieDirector.ai
// Extracted for maintainability and future API use.

import type { CharacterMedium, VoiceAxes, VoiceVariant } from '@/lib/ensemble';

export type ProjectType = 'sitcom' | 'film' | 'commercial' | 'anime' | 'brand-fusion';

export type GenQuality = 'draft' | 'final';

export type ShotKind = 'story' | 'transition';

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
  /** Generated TTS / VO audio URL (Blob or remote) */
  voiceAudioUrl?: string;
  characterIds?: string[];

  // Advanced cinematic controls
  emotion?: string;
  actingCues?: string;
  dialogue?: string;
  soundCues?: string;
  cameraDetailed?: string;
  styleNotes?: string;

  /** story = narrative beat; transition = bridge plate between story shots */
  shotKind?: ShotKind;
  isTransition?: boolean;
  bridgeFromShotId?: string;
  bridgeToShotId?: string;

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
  /** Locked environment for this shot (series set) */
  environmentId?: string;
  /** How multiple tagged characters interact in frame */
  interactionNotes?: string;
  /** Staging / blocking for multi-character shots */
  blocking?: string;
  /**
   * Video range edit: optional segment within videoUrl (seconds)
   * used when regenerating a portion of a clip.
   */
  rangeEdit?: {
    startSec: number;
    endSec: number;
    status?: 'planned' | 'replaced';
    note?: string;
  };
  /** Calibration flags attached after a sequence scan */
  calibrationIssueIds?: string[];
  /** Optional fix candidates generated for a flagged range */
  calibrationFixUrls?: string[];
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
  /** Default video resolution for 1.5 model */
  videoResolution?: '480p' | '720p' | '1080p';
  /** Prefer multi-ref character/set lock on video when no still */
  preferMultiRefVideo?: boolean;
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
  /**
   * Where this person sits in their reference still
   * (e.g. "far left doorway", "only a shadow silhouette").
   * Critical when multiple people share one discover frame.
   */
  subjectHint?: string;
  /** hero | supporting | silhouette | background — from Discover */
  visibility?: 'hero' | 'supporting' | 'silhouette' | 'background';
  /** Lab: what they want in this episode/film */
  objective?: string;
  /** Lab: how they change */
  arc?: string;
  /** Lab: director notes — how to play them */
  directionNotes?: string;
  /** Lab: relationship map (free text) */
  relationships?: string;
  /**
   * Locked sitcom memory — always re-injected into prompts
   * (scar, catchphrase, “always late”, etc.)
   */
  memoryNotes?: string;
  /** Discrete memory facts (episode bible bullets) */
  memoryFacts?: string[];
  voiceAxes?: VoiceAxes;
  voiceVariants?: VoiceVariant[];
  activeVoiceId?: string;
  /** Preferred xAI TTS / video reference voice id (ara, eve, leo, rex, sal…) */
  ttsVoiceId?: string;
  /**
   * Optional URL of a short voice sample the director uploaded for craft notes.
   * Note: xAI video API accepts preset voice_ids only (not custom clips) in public API.
   */
  voiceSampleUrl?: string;
  /** Multi-angle / multi-shot visual plates (in addition to referenceImageUrl) */
  visualReferenceUrls?: string[];
  /**
   * Voice Profile — personality, tone, reaction style, speech patterns.
   * Injected into video prompts; pairs with ttsVoiceId for face+voice lock.
   */
  voiceProfile?: VoiceProfile;
  tags?: string[];
  /**
   * Consistency lock — when set, prompts forbid redesigning this character.
   * Survives AI gens so series cast doesn't get "wiped."
   */
  consistencyLock?: {
    modelSheet: string;
    doNotChange: string;
    referenceUrls: string[];
    locked: boolean;
    lockedAt?: string;
  };
  /** Link to downloaded/shared character pack id */
  packId?: string;
}

/** How a character sounds and reacts (packable with visual refs) */
export interface VoiceProfile {
  /** Maps to xAI preset voice when generating video/TTS */
  presetVoiceId?: string;
  tone?: string;
  reactionStyle?: string;
  speechPatterns?: string;
  energy?: string;
  notes?: string;
}

/** Locked location for series continuity (home, office, cafe…) */
export interface EnvironmentLocation {
  id: string;
  name: string;
  placeType: string;
  description: string;
  lighting?: string;
  architecture?: string;
  signatureProps?: string;
  referenceImageUrl?: string;
  /** Extra stills of the same place (angles, time of day) */
  visualReferenceUrls?: string[];
  /** Floor plan / geography notes for procedural reuse */
  layoutNotes?: string;
  /** Style laws for this place only */
  styleNotes?: string;
  /** Town / district / building hierarchy */
  parentLocationId?: string;
  consistencyLock?: {
    modelSheet: string;
    doNotChange: string;
    referenceUrls: string[];
    locked: boolean;
    lockedAt?: string;
  };
  packId?: string;
}

/** Alias — Location Library uses the same shape as EnvironmentLocation */
export type LocationProfile = EnvironmentLocation;

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
  /** Marketing Studio brand kit (short-form / ads) */
  brandKit?: {
    brandName?: string;
    product?: string;
    audience?: string;
    offer?: string;
    cta?: string;
    tone?: string;
    visualLaws?: string;
    never?: string;
    competitorsAvoid?: string;
    urlOrHandle?: string;
  };
  /** Active ad format id from Marketing Studio */
  adFormatId?: string;
  /** Locked environments / Location Library for this project / series */
  environments?: EnvironmentLocation[];
  /** Default environment id for new shots */
  defaultEnvironmentId?: string;
  /** Whether Director's Mark title beat was inserted */
  directorsMarkInserted?: boolean;
  /** Last calibration report JSON */
  calibrationReport?: {
    scannedAt: string;
    issueCount: number;
    summary: string;
    issues: Array<Record<string, unknown>>;
  };
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
