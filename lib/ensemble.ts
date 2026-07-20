/**
 * Ensemble Atelier + The Company
 *
 * The Company = your reusable cast library (better than "character vault").
 * Persona Forge = wizard to assemble a character across mediums.
 * Voice Lab = alternate vocal textures (never celebrity/IP clones).
 */

export type CharacterMedium =
  | 'live-action'
  | 'cartoon-2d'
  | 'anime'
  | '3d-cgi'
  | 'claymation'
  | 'stop-motion'
  | 'pixel'
  | 'mixed-media';

export const CHARACTER_MEDIUMS: {
  id: CharacterMedium;
  label: string;
  desc: string;
  promptHint: string;
}[] = [
  {
    id: 'live-action',
    label: 'Live action',
    desc: 'Photoreal human or practical costume.',
    promptHint: 'Photoreal live-action performer, natural skin texture, real wardrobe fabric.',
  },
  {
    id: 'cartoon-2d',
    label: 'Cartoon 2D',
    desc: 'Limited or full 2D animation design.',
    promptHint: 'Stylized 2D cartoon character design, clean readable silhouette, consistent model sheet look.',
  },
  {
    id: 'anime',
    label: 'Anime',
    desc: 'Anime-proportioned 2D design.',
    promptHint: 'Anime character design, expressive eyes, clean linework, cel shading.',
  },
  {
    id: '3d-cgi',
    label: '3D CGI',
    desc: 'Feature or stylized CG model.',
    promptHint: '3D CGI character, coherent topology silhouette, subsurface skin or stylized shader.',
  },
  {
    id: 'claymation',
    label: 'Claymation',
    desc: 'Sculpted clay puppet energy.',
    promptHint: 'Claymation puppet character, visible clay texture and thumbprints, armature-friendly proportions.',
  },
  {
    id: 'stop-motion',
    label: 'Stop-motion',
    desc: 'Fabric/foam/armature puppet.',
    promptHint: 'Stop-motion puppet, fabric and foam textures, handcrafted joints, miniature scale.',
  },
  {
    id: 'pixel',
    label: 'Pixel / retro',
    desc: 'Pixel art or retro game sprite feel.',
    promptHint: 'Pixel-art character, limited palette, readable at small size.',
  },
  {
    id: 'mixed-media',
    label: 'Mixed media',
    desc: 'Collage / hybrid live + graphic.',
    promptHint: 'Mixed-media character combining photographic and graphic elements, intentional collage.',
  },
];

export type VoiceAxisId = 'pitch' | 'energy' | 'texture' | 'pace' | 'attitude';

export interface VoiceAxes {
  /** 0–100 */
  pitch: number;
  energy: number;
  texture: number; // smooth → gravel
  pace: number; // slow → rapid
  attitude: number; // warm → smug/deadpan
}

export const DEFAULT_VOICE_AXES: VoiceAxes = {
  pitch: 50,
  energy: 45,
  texture: 40,
  pace: 50,
  attitude: 55,
};

export interface VoiceVariant {
  id: string;
  name: string;
  /** Director-facing description for performance / TTS later */
  brief: string;
  /** Injected into generation prompts as sound/dialogue direction */
  promptSnippet: string;
  axes: VoiceAxes;
}

export interface EnsembleCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  medium: CharacterMedium;
  /** Visual DNA for consistent generation */
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
  referenceImageUrl?: string;
  /** Tags for filtering The Company */
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export function mediumLabel(id: CharacterMedium): string {
  return CHARACTER_MEDIUMS.find((m) => m.id === id)?.label || id;
}

export function buildCharacterDescription(c: Partial<EnsembleCharacter>): string {
  const medium = CHARACTER_MEDIUMS.find((m) => m.id === c.medium);
  const parts = [
    c.personality && `Personality: ${c.personality}.`,
    medium && `Medium: ${medium.promptHint}`,
    c.silhouette && `Silhouette: ${c.silhouette}.`,
    c.faceNotes && `Face: ${c.faceNotes}.`,
    c.wardrobe && `Wardrobe: ${c.wardrobe}.`,
    c.palette && `Color palette: ${c.palette}.`,
    c.signatureProp && `Signature prop: ${c.signatureProp}.`,
    c.catchphrase && `Catchphrase energy: "${c.catchphrase}".`,
  ].filter(Boolean);
  return parts.join(' ');
}

export function buildCharacterRefPrompt(
  projectTitle: string,
  c: EnsembleCharacter
): string {
  const medium = CHARACTER_MEDIUMS.find((m) => m.id === c.medium);
  return [
    `Character model-sheet reference for "${c.name}" (${c.role}) in original series "${projectTitle}".`,
    `NOT any existing copyrighted character — 100% original design.`,
    medium?.promptHint || '',
    c.description,
    buildCharacterDescription(c),
    'Neutral three-quarter portrait + clear silhouette, consistent for reuse across all shots.',
    'Turnaround-friendly lighting, high detail on face and signature wardrobe.',
    'Single consistent world design language.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Archetype seeds for sitcom / satire assembly (original IP). */
export const PERSONA_ARCHETYPES: {
  id: string;
  label: string;
  role: string;
  personality: string;
  silhouette: string;
  forStyle?: string;
}[] = [
  {
    id: 'smug-tycoon',
    label: 'Smug visionary',
    role: 'Antihero lead',
    personality: 'Absurd confidence, treats failure as branding, charming menace',
    silhouette: 'Tall sharp shoulders, iconic hair shape, power stance',
    forStyle: 'kinetic-adult-satire',
  },
  {
    id: 'hype-sidekick',
    label: 'Hype lieutenant',
    role: 'Comic sidekick',
    personality: 'Yes-man energy, occasional genius, loyalty as religion',
    silhouette: 'Shorter, angular, always mid-gesture',
    forStyle: 'kinetic-adult-satire',
  },
  {
    id: 'rival-exec',
    label: 'Rival executive',
    role: 'Antagonist',
    personality: 'Corporate ice, smiling threats, better wardrobe',
    silhouette: 'Wide shoulders, immaculate coat, cold symmetry',
    forStyle: 'kinetic-adult-satire',
  },
  {
    id: 'deadpan-assistant',
    label: 'Deadpan assistant',
    role: 'Straight man / woman',
    personality: 'Soul of the show, dry truth-teller, underpaid prophet',
    silhouette: 'Simple practical shape, expressive eyes only',
  },
  {
    id: 'chaos-intern',
    label: 'Chaos intern',
    role: 'Wild card',
    personality: 'Unfiltered, accidental truth bombs, snack-driven',
    silhouette: 'Loose hoodie energy, messy hair silhouette',
  },
  {
    id: 'voice-of-god',
    label: 'Announcer / VO god',
    role: 'Narrator presence',
    personality: 'Trailer-voice sincerity applied to nonsense',
    silhouette: 'Often off-screen; when on-screen: mic boom silhouette',
  },
];
