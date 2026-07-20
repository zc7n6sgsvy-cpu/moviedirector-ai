/**
 * Character memory — sitcom-grade continuity so cast stays consistent
 * across episodes/shots without re-prompting from scratch.
 */

import type { Character, Project, Shot } from '@/lib/types';

/** Facts that should always reappear in generation prompts. */
export function characterMemoryBlock(c: Character): string {
  const bits = [
    c.name && `${c.name}`,
    c.role && `(${c.role})`,
    c.description,
    c.faceNotes && `face memory: ${c.faceNotes}`,
    c.wardrobe && `wardrobe memory: ${c.wardrobe}`,
    c.silhouette && `silhouette: ${c.silhouette}`,
    c.palette && `palette: ${c.palette}`,
    c.signatureProp && `always has: ${c.signatureProp}`,
    c.personality && `personality: ${c.personality}`,
    c.catchphrase && `speech habit: "${c.catchphrase}"`,
    c.objective && `wants: ${c.objective}`,
    c.arc && `arc: ${c.arc}`,
    c.directionNotes && `play as: ${c.directionNotes}`,
    c.relationships && `relationships: ${c.relationships}`,
    c.memoryNotes && `locked memory: ${c.memoryNotes}`,
    (c.memoryFacts || []).length && `facts: ${(c.memoryFacts || []).join('; ')}`,
  ].filter(Boolean);
  return bits.join(' — ');
}

export function injectCastMemoryIntoPrompt(project: Project, shot: Shot, base: string): string {
  const cast = (project.characters || []).filter((c) => shot.characterIds?.includes(c.id));
  if (!cast.length) return base;
  const block = cast.map(characterMemoryBlock).join(' | ');
  return `${base} CHARACTER MEMORY (maintain exact continuity): ${block}. Same faces, wardrobe rules, props, and personality as prior shots.`;
}

/** Add a durable memory fact to a character (episode bible). */
export function appendCharacterFact(c: Character, fact: string): Character {
  const f = fact.trim();
  if (!f) return c;
  const facts = [...(c.memoryFacts || [])];
  if (facts.some((x) => x.toLowerCase() === f.toLowerCase())) return c;
  facts.push(f);
  return { ...c, memoryFacts: facts.slice(-20) };
}

/** Tag every shot with a character (insert cast into whole episode). */
export function insertCharacterOnAllShots(shots: Shot[], charId: string): Shot[] {
  return shots.map((s) => {
    if (s.shotKind === 'transition') {
      // Bridges inherit if neighbors would have them — still allow tag
    }
    const ids = new Set(s.characterIds || []);
    ids.add(charId);
    return { ...s, characterIds: [...ids] };
  });
}

export function removeCharacterFromAllShots(shots: Shot[], charId: string): Shot[] {
  return shots.map((s) => ({
    ...s,
    characterIds: (s.characterIds || []).filter((id) => id !== charId),
  }));
}
