// Shared types for MovieDirector.ai
// Extracted for maintainability and future API use.

import type { CharacterMedium, VoiceAxes, VoiceVariant } from '@/lib/ensemble';

export type ProjectType = 'sitcom' | 'film' | 'commercial' | 'anime' | 'brand-fusion';

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
  voiceAxes?: VoiceAxes;
  voiceVariants?: VoiceVariant[];
  activeVoiceId?: string;
  tags?: string[];
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
