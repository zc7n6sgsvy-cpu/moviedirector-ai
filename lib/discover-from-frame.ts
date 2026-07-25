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

CRITICAL: Respond with ONE JSON object only. No markdown fences, no commentary before or after.
Shape:
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
- Be specific so a later gen can match wardrobe and set.
- Escape any quotes inside string values. Do not put raw newlines that break JSON.`;

/**
 * Extract the first complete JSON object/array from model text.
 * Handles markdown fences, leading prose, trailing prose, and dual objects
 * (naive first `{`…last `}` fails with "Unexpected non-whitespace after JSON").
 */
export function extractJsonValue(text: string): unknown {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty model response — no JSON to parse');
  }

  let s = text.trim();
  // Strip BOM / common wrappers
  s = s.replace(/^\uFEFF/, '');

  // Prefer fenced ```json … ``` (first fence only)
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Direct parse when the whole string is JSON
  try {
    return JSON.parse(s);
  } catch {
    /* continue */
  }

  // Find first { or [ and walk balanced braces/brackets (respect strings)
  const startObj = s.indexOf('{');
  const startArr = s.indexOf('[');
  let start = -1;
  let openCh = '{';
  let closeCh = '}';
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
    start = startObj;
    openCh = '{';
    closeCh = '}';
  } else if (startArr >= 0) {
    start = startArr;
    openCh = '[';
    closeCh = ']';
  }
  if (start < 0) {
    throw new Error('No JSON object found in model response');
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch (err) {
          // Trailing commas are a common model quirk
          const cleaned = slice
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          try {
            return JSON.parse(cleaned);
          } catch {
            throw new Error(
              err instanceof Error
                ? `Discover JSON parse failed: ${err.message}`
                : 'Discover JSON parse failed'
            );
          }
        }
      }
    }
  }

  throw new Error('Unclosed JSON in model response');
}

export function parseDiscoveryJson(text: string): FrameDiscovery {
  let data: {
    characters?: Array<Record<string, string | undefined>>;
    environment?: Record<string, unknown>;
    rawNotes?: string;
  };

  try {
    const parsed = extractJsonValue(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object with characters/environment');
    }
    data = parsed as typeof data;
  } catch (err) {
    const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 180);
    throw new Error(
      `${err instanceof Error ? err.message : 'Invalid discover JSON'}. Preview: ${snippet}…`
    );
  }

  const characters: DiscoveredCharacter[] = (data.characters || []).map((c, i) => ({
    tempId: `disc-${Date.now().toString(36)}-${i}`,
    suggestedName: String(c.suggestedName || c.name || `Character ${i + 1}`).trim(),
    role: String(c.role || 'Ensemble').trim(),
    faceNotes: String(c.faceNotes || '').trim(),
    wardrobe: String(c.wardrobe || '').trim(),
    description: String(
      c.description || [c.faceNotes, c.wardrobe].filter(Boolean).join('. ')
    ).trim(),
    personality: c.personality ? String(c.personality).trim() : undefined,
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

  return {
    characters,
    environment,
    rawNotes: data.rawNotes ? String(data.rawNotes) : undefined,
  };
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
  const desc =
    (d.description || '').trim() ||
    `Series location "${d.name || 'Set'}". Hold architecture, palette, and props fixed across all shots.`;
  const pack = createEnvironmentPack({
    name: (d.name || 'Discovered set').trim(),
    placeType: d.placeType || 'other',
    description: desc,
    lighting: d.lighting,
    signatureProps: props || undefined,
    referenceImageUrl,
    doNotChange:
      'Never redesign architecture, wall color, furniture layout, windows, flooring, or signature props. Same place every shot — series continuity plate.',
  });
  // Always pin the discover frame as the sacred plate
  if (referenceImageUrl) {
    pack.lock.referenceUrls = [
      referenceImageUrl,
      ...pack.lock.referenceUrls.filter((u) => u !== referenceImageUrl),
    ];
    pack.lock.locked = true;
    pack.lock.lockedAt = new Date().toISOString();
  }
  return {
    id: pack.id,
    name: pack.name,
    placeType: pack.placeType,
    description: pack.description,
    lighting: pack.lighting,
    signatureProps: pack.signatureProps,
    referenceImageUrl: referenceImageUrl || pack.lock.referenceUrls[0],
    consistencyLock: { ...pack.lock, locked: true },
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
  const parsed = extractJsonValue(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expand returned invalid JSON');
  }
  const data = parsed as SceneExpandResult;
  if (!data.description) throw new Error('Expand returned no description');
  return {
    description: String(data.description),
    camera: data.camera ? String(data.camera) : 'Medium shot',
    dialogue: data.dialogue ? String(data.dialogue) : undefined,
    emotion: data.emotion ? String(data.emotion) : undefined,
    suggestedCharacterNames: Array.isArray(data.suggestedCharacterNames)
      ? data.suggestedCharacterNames.map(String)
      : undefined,
    environmentHint: data.environmentHint ? String(data.environmentHint) : undefined,
  };
}
