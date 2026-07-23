/**
 * Discover cast + environment from a creative AI frame.
 *
 * Creative flow: Grok invents a scene → user likes people/place →
 * discover labels them → lock packs → reuse on empty later shots.
 */

import type { Character, EnvironmentLocation } from '@/lib/types';
import { lockCharacter, createEnvironmentPack } from '@/lib/consistency-packs';

export type DiscoveredCharacter = {
  tempId: string;
  suggestedName: string;
  role: string;
  faceNotes: string;
  wardrobe: string;
  description: string;
  personality?: string;
  /** Include in cast by default */
  selected: boolean;
};

export type DiscoveredEnvironment = {
  name: string;
  placeType: string;
  description: string;
  lighting?: string;
  signatureProps?: string;
  items?: string[];
  selected: boolean;
};

export type FrameDiscovery = {
  characters: DiscoveredCharacter[];
  environment: DiscoveredEnvironment | null;
  rawNotes?: string;
};

export const DISCOVER_SYSTEM_PROMPT = `You are a continuity supervisor for an AI film studio.
Analyze the image and extract reusable CHARACTER and ENVIRONMENT locks for a series bible.
Return ONLY valid JSON (no markdown fences) matching:
{
  "characters": [
    {
      "suggestedName": "short original name (not a celebrity)",
      "role": "role in scene",
      "faceNotes": "face, hair, age vibe, distinguishing marks",
      "wardrobe": "exact clothes visible",
      "description": "full model-sheet one paragraph",
      "personality": "optional vibe from pose/expression"
    }
  ],
  "environment": {
    "name": "short set name e.g. War Room",
    "placeType": "home|office|cafe|exterior|lab|other",
    "description": "architecture, colors, layout — enough to rebuild the set",
    "lighting": "lighting description",
    "signatureProps": "props that define the set",
    "items": ["list", "of", "notable", "objects"]
  },
  "rawNotes": "optional continuity notes"
}
Rules:
- List EVERY distinct person clearly visible (up to 8).
- Do NOT invent people who are not in the image.
- Names must be original (no real celebrities).
- Environment describes THIS location for series reuse.
- Be specific so a later gen can match wardrobe and set.`;

export function parseDiscoveryJson(text: string): FrameDiscovery {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);

  const data = JSON.parse(raw) as {
    characters?: Array<Record<string, string>>;
    environment?: Record<string, unknown>;
    rawNotes?: string;
  };

  const characters: DiscoveredCharacter[] = (data.characters || []).map((c, i) => ({
    tempId: `disc-${Date.now().toString(36)}-${i}`,
    suggestedName: (c.suggestedName || c.name || `Character ${i + 1}`).trim(),
    role: (c.role || 'Ensemble').trim(),
    faceNotes: (c.faceNotes || '').trim(),
    wardrobe: (c.wardrobe || '').trim(),
    description: (c.description || [c.faceNotes, c.wardrobe].filter(Boolean).join('. ')).trim(),
    personality: c.personality?.trim(),
    selected: true,
  }));

  let environment: DiscoveredEnvironment | null = null;
  if (data.environment && typeof data.environment === 'object') {
    const e = data.environment;
    environment = {
      name: String(e.name || 'Discovered set').trim(),
      placeType: String(e.placeType || 'other').trim(),
      description: String(e.description || '').trim(),
      lighting: e.lighting ? String(e.lighting) : undefined,
      signatureProps: e.signatureProps ? String(e.signatureProps) : undefined,
      items: Array.isArray(e.items) ? e.items.map(String) : undefined,
      selected: true,
    };
  }

  return { characters, environment, rawNotes: data.rawNotes };
}

export function discoveredToCharacter(
  d: DiscoveredCharacter,
  referenceImageUrl?: string
): Character {
  const char: Character = {
    id: `char-${Math.random().toString(36).slice(2, 11)}`,
    name: d.suggestedName,
    role: d.role,
    description: d.description || `${d.faceNotes}. ${d.wardrobe}`.trim(),
    faceNotes: d.faceNotes,
    wardrobe: d.wardrobe,
    personality: d.personality,
    referenceImageUrl,
    tags: ['discovered'],
  };
  return lockCharacter(char);
}

export function discoveredToEnvironment(
  d: DiscoveredEnvironment,
  referenceImageUrl?: string
): EnvironmentLocation {
  const props = [d.signatureProps, d.items?.join(', ')].filter(Boolean).join('; ');
  const pack = createEnvironmentPack({
    name: d.name,
    placeType: d.placeType,
    description: d.description,
    lighting: d.lighting,
    signatureProps: props,
    referenceImageUrl,
  });
  return {
    id: pack.id,
    name: pack.name,
    placeType: pack.placeType,
    description: pack.description,
    lighting: pack.lighting,
    signatureProps: pack.signatureProps,
    referenceImageUrl: referenceImageUrl || pack.lock.referenceUrls[0],
    consistencyLock: pack.lock,
    packId: pack.id,
  };
}

export type SceneExpandResult = {
  description: string;
  camera: string;
  dialogue?: string;
  emotion?: string;
  suggestedCharacterNames?: string[];
  environmentHint?: string;
};

export function parseSceneExpandJson(text: string): SceneExpandResult {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  const data = JSON.parse(raw) as SceneExpandResult;
  if (!data.description) throw new Error('Expand returned no description');
  return {
    description: data.description,
    camera: data.camera || 'Medium shot',
    dialogue: data.dialogue,
    emotion: data.emotion,
    suggestedCharacterNames: data.suggestedCharacterNames,
    environmentHint: data.environmentHint,
  };
}
