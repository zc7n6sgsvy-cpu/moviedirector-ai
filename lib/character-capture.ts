/**
 * Character capture bank — make discovered people reusable with maximum fidelity.
 *
 * Problem: Discover often locks everyone to the SAME multi-person still.
 * Reinsert then promotes the wrong face (Dane → someone else).
 *
 * Solution:
 * 1) Rich identity card (face, wardrobe, subject position, isolation law)
 * 2) Solo character plate via image-edit extract (dedicated ref URL)
 * 3) Pack export includes full card + plate for other projects
 */

import type { Character } from '@/lib/types';
import { characterToPack, lockCharacter } from '@/lib/consistency-packs';
import type { DiscoveredCharacter } from '@/lib/discover-from-frame';

export const SOLO_PLATE_CREDITS_HINT = 2; // draft-class image edit

/** Build a durable identity card string for model sheets + prompts */
export function buildIdentityCard(c: {
  name: string;
  role?: string;
  faceNotes?: string;
  wardrobe?: string;
  silhouette?: string;
  subjectHint?: string;
  visibility?: string;
  description?: string;
  personality?: string;
}): string {
  return [
    `IDENTITY CARD: ${c.name}`,
    c.role && `Role: ${c.role}`,
    c.visibility && `Visibility at capture: ${c.visibility}`,
    c.subjectHint && `In-source position: ${c.subjectHint}`,
    c.faceNotes && `Face: ${c.faceNotes}`,
    c.wardrobe && `Wardrobe: ${c.wardrobe}`,
    c.silhouette && `Build/silhouette: ${c.silhouette}`,
    c.personality && `Energy: ${c.personality}`,
    c.description && `Sheet: ${c.description}`,
    'Reuse law: this identity is fixed. Never swap for another cast member.',
  ]
    .filter(Boolean)
    .join('. ');
}

/**
 * Image-edit prompt: carve ONE person out of a multi-person production still
 * into a reusable solo model-sheet plate.
 */
export function buildSoloPlateExtractPrompt(c: {
  name: string;
  role?: string;
  faceNotes?: string;
  wardrobe?: string;
  subjectHint?: string;
  description?: string;
  visibility?: string;
}): string {
  const find =
    c.subjectHint ||
    (c.visibility === 'silhouette' || c.visibility === 'background'
      ? 'the figure matching the notes below (may be dimmer / further back)'
      : 'the person matching the notes below');

  return [
    'CHARACTER CAPTURE — extract a reusable solo model-sheet plate.',
    'Image 1 is a production still that may contain multiple people.',
    `EXTRACT ONLY: "${c.name}" (${c.role || 'character'}). Find them as: ${find}.`,
    c.faceNotes ? `Face lock: ${c.faceNotes}.` : '',
    c.wardrobe ? `Wardrobe lock: ${c.wardrobe}.` : '',
    c.description ? `Full sheet: ${c.description.slice(0, 280)}.` : '',
    'OUTPUT: single-subject three-quarter or full-body portrait of ONLY this person.',
    'Neutral or soft studio/set backdrop is fine — MUST keep exact face, hair, body type, wardrobe.',
    'DELETE every other person completely. No second figure, no crowd, no wrong-face swap.',
    'This plate will be reused for series continuity — fidelity over creativity.',
    'No text, logos, watermarks, or celebrity lookalikes.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Finalize a discovered character into bank-ready data BEFORE solo plate gen.
 * sourceFrameUrl is temporary (multi-person); solo plate will replace primary ref.
 */
export function captureCharacterFromDiscover(
  d: DiscoveredCharacter,
  sourceFrameUrl: string
): Character {
  const visibility = d.visibility || 'supporting';
  const subjectHint = (d.subjectHint || '').trim();
  const faceNotes = (d.faceNotes || '').trim();
  const wardrobe = (d.wardrobe || '').trim();
  const description = (d.description || [faceNotes, wardrobe].filter(Boolean).join('. ')).trim();

  const isolation = [
    `CAPTURE SOURCE: multi-person still. Subject "${d.suggestedName}" only.`,
    subjectHint && `Position in source: ${subjectHint}.`,
    `Visibility: ${visibility}.`,
    'When reinserting: use solo plate if present; never promote a different face from a group still.',
    'If source still shows multiple people, pick this subject by face/wardrobe/position — not the largest face.',
  ]
    .filter(Boolean)
    .join(' ');

  const identityCard = buildIdentityCard({
    name: d.suggestedName,
    role: d.role,
    faceNotes,
    wardrobe,
    subjectHint,
    visibility,
    description,
    personality: d.personality,
  });

  const char: Character = {
    id: `char-${Math.random().toString(36).slice(2, 11)}`,
    name: d.suggestedName.trim() || 'Unnamed',
    role: (d.role || 'Ensemble').trim(),
    description: description || identityCard,
    faceNotes,
    wardrobe,
    personality: d.personality?.trim(),
    silhouette:
      visibility === 'silhouette'
        ? faceNotes || subjectHint || 'silhouette figure'
        : undefined,
    subjectHint: subjectHint || undefined,
    visibility,
    // Keep source as fallback until solo plate lands; mark as provisional
    referenceImageUrl: sourceFrameUrl,
    memoryNotes: isolation,
    memoryFacts: [
      `captured_from_group_still`,
      subjectHint ? `position:${subjectHint}` : '',
      `visibility:${visibility}`,
      faceNotes ? `face:${faceNotes}` : '',
      wardrobe ? `wardrobe:${wardrobe}` : '',
    ].filter(Boolean),
    tags: [
      'discovered',
      'captured',
      visibility,
      'needs-solo-plate',
      ...(visibility === 'silhouette' || visibility === 'background' ? ['weak-source'] : []),
    ],
  };

  const locked = lockCharacter(char);
  // Enrich model sheet with full identity card
  return {
    ...locked,
    consistencyLock: {
      ...(locked.consistencyLock || {
        modelSheet: identityCard,
        doNotChange: '',
        referenceUrls: [sourceFrameUrl],
        locked: true,
      }),
      modelSheet: identityCard,
      doNotChange: [
        faceNotes && `Face: ${faceNotes}`,
        wardrobe && `Wardrobe: ${wardrobe}`,
        'Never swap this identity for another cast member.',
        subjectHint && `Source position was: ${subjectHint}`,
      ]
        .filter(Boolean)
        .join(' '),
      referenceUrls: [sourceFrameUrl],
      locked: true,
      lockedAt: new Date().toISOString(),
    },
  };
}

/** Attach a dedicated solo plate URL as the primary reusable reference */
export function applySoloPlateToCharacter(c: Character, soloPlateUrl: string): Character {
  const refs = [
    soloPlateUrl,
    ...(c.consistencyLock?.referenceUrls || []),
    c.referenceImageUrl || '',
  ].filter((u, i, a) => u && a.indexOf(u) === i);

  const tags = (c.tags || []).filter((t) => t !== 'needs-solo-plate');
  if (!tags.includes('solo-plate')) tags.push('solo-plate');
  if (!tags.includes('captured')) tags.push('captured');

  return {
    ...c,
    referenceImageUrl: soloPlateUrl,
    tags,
    consistencyLock: {
      modelSheet:
        c.consistencyLock?.modelSheet ||
        buildIdentityCard(c),
      doNotChange:
        c.consistencyLock?.doNotChange ||
        'Never alter face, hair, body type, or signature wardrobe from the solo plate.',
      referenceUrls: refs,
      locked: true,
      lockedAt: c.consistencyLock?.lockedAt || new Date().toISOString(),
    },
    memoryNotes: [
      c.memoryNotes,
      'SOLO PLATE captured — primary reference for all reinserts.',
    ]
      .filter(Boolean)
      .join(' '),
    memoryFacts: [
      ...(c.memoryFacts || []).filter((f) => f !== 'captured_from_group_still'),
      'solo_plate_ready',
    ],
  };
}

export function characterNeedsSoloPlate(c: Character): boolean {
  return (
    (c.tags || []).includes('needs-solo-plate') ||
    (c.tags || []).includes('discovered') && !(c.tags || []).includes('solo-plate')
  );
}

/** Export-ready pack after capture (+ optional solo plate) */
export function captureToPack(c: Character) {
  return characterToPack(c);
}
