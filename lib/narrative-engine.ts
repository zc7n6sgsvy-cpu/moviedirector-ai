/**
 * Narrative Engine — showrunner + plot-twist specialist.
 *
 * Proposes elevated story versions; director accepts one.
 * Additive: writes into script / synopsis / shot descriptions.
 */

import type { Project, ProjectType, Shot } from '@/lib/types';
import { isTransitionShot } from '@/lib/transitions';
import { extractJsonValue } from '@/lib/discover-from-frame';

export type NarrativeMode =
  | 'full-upgrade'
  | 'beginning-hook'
  | 'ending-cliffhanger'
  | 'selected-range'
  | 'mid-hooks'
  | 'amplify'
  | 'plot-twist';

export type NarrativeGenre =
  | 'romance'
  | 'anime'
  | 'comedy'
  | 'fantasy'
  | 'action'
  | 'thriller'
  | 'horror'
  | 'drama'
  | 'sitcom'
  | 'auto';

export type EmotionalTarget =
  | 'make-them-cry'
  | 'edge-of-seat'
  | 'obsession-next-episode'
  | 'quiet-devastation'
  | 'shocking-earned-twist'
  | 'raise-stakes'
  | 'deepen-attachment';

export type NarrativeBeatChange = {
  beatLabel: string;
  beforeHint?: string;
  after: string;
  shotNumbers?: number[];
  isTwist?: boolean;
};

export type NarrativeVersion = {
  id: string;
  title: string;
  loglineUpgrade?: string;
  synopsisUpgrade?: string;
  /** Full or partial script replacement / insertion */
  scriptPatch?: string;
  /** How to apply script: replace | prepend | append | merge-end */
  scriptApply?: 'replace' | 'prepend' | 'append' | 'merge-end';
  twistSummary?: string;
  twistSetup?: string;
  twistMisdirection?: string;
  twistPayoff?: string;
  emotionalArc?: string;
  beatChanges: NarrativeBeatChange[];
  /** Concrete shot description updates */
  shotUpdates?: Array<{
    shotNumber: number;
    description?: string;
    dialogue?: string;
    emotion?: string;
    camera?: string;
  }>;
  /** Optional new beats to insert after a shot number */
  insertAfterShot?: number;
  newShots?: Array<{
    description: string;
    dialogue?: string;
    emotion?: string;
    camera?: string;
    duration?: number;
  }>;
  whyItWorks: string;
};

export type NarrativeEngineResult = {
  genreApplied: NarrativeGenre;
  mode: NarrativeMode;
  targets: EmotionalTarget[];
  versions: NarrativeVersion[];
  directorNotes?: string;
};

export const NARRATIVE_MODES: {
  id: NarrativeMode;
  label: string;
  short: string;
  purpose: string;
}[] = [
  {
    id: 'full-upgrade',
    label: 'Full Story Upgrade',
    short: 'Full',
    purpose: 'Elevate the entire episode — stakes, structure, emotion, twist readiness.',
  },
  {
    id: 'beginning-hook',
    label: 'Beginning Hook',
    short: 'Open',
    purpose: 'Make the first minutes impossible to leave.',
  },
  {
    id: 'ending-cliffhanger',
    label: 'Ending / Cliffhanger',
    short: 'End',
    purpose: 'Final minutes engineered for “I need the next episode.”',
  },
  {
    id: 'selected-range',
    label: 'Selected Range',
    short: 'Range',
    purpose: 'Only twist/upgrade the highlighted shots or script slice.',
  },
  {
    id: 'mid-hooks',
    label: 'Mid-Episode Hooks',
    short: 'Mids',
    purpose: 'Insert or strengthen tension spikes and mini-cliffhangers throughout.',
  },
  {
    id: 'amplify',
    label: 'Amplify / Elevate',
    short: 'Amp',
    purpose: 'Keep the core idea; raise stakes, emotion, and tension.',
  },
  {
    id: 'plot-twist',
    label: 'Plot Twist Masterpiece',
    short: 'Twist',
    purpose: 'Setup → misdirection → earned payoff. Genre-perfect twist craft.',
  },
];

export const NARRATIVE_GENRES: { id: NarrativeGenre; label: string }[] = [
  { id: 'auto', label: 'Auto (from project)' },
  { id: 'sitcom', label: 'Sitcom' },
  { id: 'romance', label: 'Romance' },
  { id: 'anime', label: 'Anime' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'drama', label: 'Drama' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'action', label: 'Action' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'horror', label: 'Horror' },
];

export const EMOTIONAL_TARGETS: { id: EmotionalTarget; label: string }[] = [
  { id: 'make-them-cry', label: 'Make the audience cry' },
  { id: 'edge-of-seat', label: 'Edge of their seat' },
  { id: 'obsession-next-episode', label: 'Obsession — need next episode now' },
  { id: 'quiet-devastation', label: 'Quiet devastating moment' },
  { id: 'shocking-earned-twist', label: 'Shocking but earned twist' },
  { id: 'raise-stakes', label: 'Raise tension and stakes' },
  { id: 'deepen-attachment', label: 'Deepen attachment to characters' },
];

/** Genre-correct emotional grammar for the specialist brain */
export const GENRE_GRAMMAR: Record<Exclude<NarrativeGenre, 'auto'>, string> = {
  romance:
    'ROMANCE grammar: emotional devastation, almost-confessions, interrupted intimacy, quiet heartbreak, addictive longing. Twists reframe who loves whom or what was never said — never cheap “secret twin.” Earn tears through nearness denied.',
  anime:
    'ANIME grammar: heightened feeling, quiet frames that break, loyalty tests, almost-confessions, longing that aches. Twists are emotional reveals and fate/choice collisions — melodrama with sincerity, not parody.',
  comedy:
    'COMEDY grammar: escalating awkwardness, unfinished social disasters, delayed punchlines, status humiliation. Twists escalate the trap the character is in — funnier and more painful because they dug the hole.',
  fantasy:
    'FANTASY grammar: power shifts, prophecies with double meaning, alliances that crack, impossible choices. Twists recontextualize magic cost or identity — earned by prior lore crumbs.',
  action:
    'ACTION grammar: momentum, betrayals, ticking clocks, sudden power reversals. Twists change who the real opponent is or what the mission actually costs — physical and moral.',
  thriller:
    'THRILLER grammar: false safety, withheld information, presence of threat, trust erosion. Twists reframe evidence the audience already saw — fair-play paranoia.',
  horror:
    'HORROR grammar: false safety, rules of the threat, dread in ordinary space. Twists reveal the threat was closer/rules were wrong — not random gore.',
  drama:
    'DRAMA grammar: moral crossroads, irreversible decisions, relationship fractures, dignity under pressure. Twists are emotional truth bombs — someone finally says or does the thing that cannot be undone.',
  sitcom:
    'SITCOM grammar: status games, workplace/family pressure cookers, jokes with emotional undercurrent. Twists raise the personal cost of the A-plot lie — still funny, now addictive.',
};

export function detectGenreFromProject(project: Project): Exclude<NarrativeGenre, 'auto'> {
  const blob = [
    project.type,
    project.logline,
    project.concept,
    project.worldBible?.tone,
    project.worldBible?.themes,
    project.style?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/horror|terror|ghost|slasher/.test(blob)) return 'horror';
  if (/thriller|conspiracy|spy|murder mystery/.test(blob)) return 'thriller';
  if (/anime|shonen|shojo|mecha/.test(blob)) return 'anime';
  if (/romance|love|dating|heartbreak/.test(blob)) return 'romance';
  if (/fantasy|magic|dragon|wizard|quest/.test(blob)) return 'fantasy';
  if (/action|heist|fight|battle|chase/.test(blob)) return 'action';
  if (/comedy|funny|satire|farce/.test(blob)) return 'comedy';
  if (project.type === 'sitcom' || /sitcom|workplace comedy/.test(blob)) return 'sitcom';
  if (project.type === 'anime') return 'anime';
  if (project.type === 'film' || /drama|prestige/.test(blob)) return 'drama';
  return 'drama';
}

export function resolveGenre(
  selected: NarrativeGenre,
  project: Project
): Exclude<NarrativeGenre, 'auto'> {
  if (selected !== 'auto') return selected;
  return detectGenreFromProject(project);
}

export function buildNarrativeSystemPrompt(
  genre: Exclude<NarrativeGenre, 'auto'>,
  mode: NarrativeMode
): string {
  return `You are a world-class showrunner and master plot-twist specialist for an AI film studio (MovieDirector).
You elevate stories into addictive, high-stakes, emotionally charged narratives. You never write generic AI mush.
${GENRE_GRAMMAR[genre]}

MODE: ${mode}
- full-upgrade: restructure episode for max addiction while honoring the user's core idea
- beginning-hook: only cold open / first acts — impossible to leave
- ending-cliffhanger: final minutes — next-episode desperation
- selected-range: ONLY the provided shot range / excerpt
- mid-hooks: place 2–4 tension spikes / mini-cliffhangers across the middle
- amplify: keep premise; raise stakes and emotion only
- plot-twist: design setup crumbs, misdirection, and earned payoff (twist must be fair and genre-correct)

Rules:
- Original characters only (no celebrities)
- Twists must be EARNED — plant setup in beat changes when possible
- Prefer concrete visual beats a director can shoot as key stills
- Offer variety across versions (different emotional angle or twist mechanism)
- Return ONLY valid JSON (no markdown fences)

JSON shape:
{
  "genreApplied": "${genre}",
  "mode": "${mode}",
  "targets": ["..."],
  "directorNotes": "optional one-line showrunner note",
  "versions": [
    {
      "id": "v1",
      "title": "short version name",
      "loglineUpgrade": "optional sharpened logline",
      "synopsisUpgrade": "optional treatment paragraph",
      "scriptPatch": "optional teleplay-style text for this scope",
      "scriptApply": "replace|prepend|append|merge-end",
      "twistSummary": "if any",
      "twistSetup": "how the audience is prepared",
      "twistMisdirection": "what they think is true",
      "twistPayoff": "the turn",
      "emotionalArc": "feeling journey",
      "beatChanges": [
        {
          "beatLabel": "Cold open / Midpoint / Tag / etc",
          "beforeHint": "optional what it was",
          "after": "concrete upgraded beat",
          "shotNumbers": [1, 2],
          "isTwist": false
        }
      ],
      "shotUpdates": [
        {
          "shotNumber": 1,
          "description": "visual action for key still",
          "dialogue": "optional",
          "emotion": "optional",
          "camera": "optional"
        }
      ],
      "insertAfterShot": 3,
      "newShots": [
        {
          "description": "...",
          "dialogue": "...",
          "emotion": "...",
          "camera": "Medium",
          "duration": 6
        }
      ],
      "whyItWorks": "why this version is addictive / genre-correct"
    }
  ]
}
Provide 2 or 3 versions in "versions" (never more than 3).`;
}

export function buildNarrativeUserPrompt(input: {
  project: Project;
  mode: NarrativeMode;
  genre: Exclude<NarrativeGenre, 'auto'>;
  targets: EmotionalTarget[];
  selectedShotNumbers?: number[];
  scriptExcerpt?: string;
}): string {
  const { project, mode, genre, targets, selectedShotNumbers, scriptExcerpt } = input;
  const shots = (project.shots || []).filter((s) => !isTransitionShot(s));
  const cast = (project.characters || [])
    .map((c) => `${c.name} (${c.role}): ${(c.description || '').slice(0, 100)}`)
    .join('\n');

  const shotBlock = shots
    .map(
      (s) =>
        `#${s.number} [${s.camera || '?'}] ${s.description || ''}` +
        (s.dialogue ? ` | DLG: ${s.dialogue}` : '') +
        (s.emotion ? ` | EMO: ${s.emotion}` : '')
    )
    .join('\n');

  const range =
    mode === 'selected-range' && selectedShotNumbers?.length
      ? `SELECTED SHOTS ONLY: ${selectedShotNumbers.join(', ')}`
      : mode === 'beginning-hook'
        ? 'SCOPE: Opening / cold open and first act beats only'
        : mode === 'ending-cliffhanger'
          ? 'SCOPE: Final act and last shots only'
          : mode === 'mid-hooks'
            ? 'SCOPE: Middle of episode — insert or upgrade hooks'
            : 'SCOPE: Full episode as provided';

  const targetLabels = targets
    .map((t) => EMOTIONAL_TARGETS.find((x) => x.id === t)?.label || t)
    .join('; ');

  return [
    `Series: "${project.title}"`,
    `Type: ${project.type}`,
    `Logline: ${project.logline || ''}`,
    project.concept ? `Concept: ${project.concept}` : '',
    `Genre grammar: ${genre}`,
    `Emotional targets: ${targetLabels || 'raise stakes + keep them watching'}`,
    range,
    cast ? `CAST:\n${cast}` : 'CAST: invent carefully if missing; stay original',
    scriptExcerpt
      ? `SCRIPT / EXCERPT:\n${scriptExcerpt.slice(0, 4000)}`
      : project.script
        ? `SCRIPT:\n${String(project.script).slice(0, 3500)}`
        : project.synopsis
          ? `SYNOPSIS:\n${String(project.synopsis).slice(0, 2000)}`
          : '',
    shotBlock ? `SHOT LIST:\n${shotBlock.slice(0, 3500)}` : 'No shot list yet — propose beats that can become shots.',
    'Produce 2–3 director-ready versions as JSON.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function parseNarrativeResult(text: string, fallback: {
  mode: NarrativeMode;
  genre: Exclude<NarrativeGenre, 'auto'>;
  targets: EmotionalTarget[];
}): NarrativeEngineResult {
  const raw = extractJsonValue(text) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new Error('Narrative engine returned no JSON');

  const versionsIn = Array.isArray(raw.versions) ? raw.versions : [];
  if (!versionsIn.length) throw new Error('Narrative engine returned no versions');

  const versions: NarrativeVersion[] = versionsIn.slice(0, 3).map((v, i) => {
    const o = v as Record<string, unknown>;
    const beats = Array.isArray(o.beatChanges) ? o.beatChanges : [];
    return {
      id: String(o.id || `v${i + 1}`),
      title: String(o.title || `Version ${i + 1}`),
      loglineUpgrade: o.loglineUpgrade ? String(o.loglineUpgrade) : undefined,
      synopsisUpgrade: o.synopsisUpgrade ? String(o.synopsisUpgrade) : undefined,
      scriptPatch: o.scriptPatch ? String(o.scriptPatch) : undefined,
      scriptApply: (['replace', 'prepend', 'append', 'merge-end'] as const).includes(
        o.scriptApply as 'replace'
      )
        ? (o.scriptApply as NarrativeVersion['scriptApply'])
        : 'merge-end',
      twistSummary: o.twistSummary ? String(o.twistSummary) : undefined,
      twistSetup: o.twistSetup ? String(o.twistSetup) : undefined,
      twistMisdirection: o.twistMisdirection ? String(o.twistMisdirection) : undefined,
      twistPayoff: o.twistPayoff ? String(o.twistPayoff) : undefined,
      emotionalArc: o.emotionalArc ? String(o.emotionalArc) : undefined,
      beatChanges: beats.map((b) => {
        const x = b as Record<string, unknown>;
        return {
          beatLabel: String(x.beatLabel || 'Beat'),
          beforeHint: x.beforeHint ? String(x.beforeHint) : undefined,
          after: String(x.after || ''),
          shotNumbers: Array.isArray(x.shotNumbers)
            ? x.shotNumbers.map((n) => Number(n)).filter((n) => !Number.isNaN(n))
            : undefined,
          isTwist: !!x.isTwist,
        };
      }),
      shotUpdates: Array.isArray(o.shotUpdates)
        ? (o.shotUpdates as Array<Record<string, unknown>>).map((u) => ({
            shotNumber: Number(u.shotNumber) || 0,
            description: u.description ? String(u.description) : undefined,
            dialogue: u.dialogue ? String(u.dialogue) : undefined,
            emotion: u.emotion ? String(u.emotion) : undefined,
            camera: u.camera ? String(u.camera) : undefined,
          }))
        : undefined,
      insertAfterShot:
        o.insertAfterShot != null ? Number(o.insertAfterShot) : undefined,
      newShots: Array.isArray(o.newShots)
        ? (o.newShots as Array<Record<string, unknown>>).map((s) => ({
            description: String(s.description || ''),
            dialogue: s.dialogue ? String(s.dialogue) : undefined,
            emotion: s.emotion ? String(s.emotion) : undefined,
            camera: s.camera ? String(s.camera) : 'Medium shot',
            duration: s.duration != null ? Number(s.duration) : 6,
          }))
        : undefined,
      whyItWorks: String(o.whyItWorks || 'Elevates stakes with genre-correct craft.'),
    };
  });

  return {
    genreApplied: fallback.genre,
    mode: fallback.mode,
    targets: fallback.targets,
    versions,
    directorNotes: raw.directorNotes ? String(raw.directorNotes) : undefined,
  };
}

/** Apply accepted version into project script + shots (director control). */
export function applyNarrativeVersion(
  project: Project,
  version: NarrativeVersion,
  opts?: { writeScript?: boolean; writeShots?: boolean; writeLogline?: boolean }
): Project {
  const writeScript = opts?.writeScript !== false;
  const writeShots = opts?.writeShots !== false;
  const writeLogline = opts?.writeLogline !== false;

  let next: Project = { ...project };

  if (writeLogline && version.loglineUpgrade?.trim()) {
    next = { ...next, logline: version.loglineUpgrade.trim() };
  }
  if (version.synopsisUpgrade?.trim()) {
    next = { ...next, synopsis: version.synopsisUpgrade.trim() };
  }

  if (writeScript && version.scriptPatch?.trim()) {
    const patch = version.scriptPatch.trim();
    const apply = version.scriptApply || 'merge-end';
    const cur = next.script || '';
    let script = cur;
    if (apply === 'replace' || !cur.trim()) script = patch;
    else if (apply === 'prepend') script = `${patch}\n\n${cur}`;
    else if (apply === 'append' || apply === 'merge-end') script = `${cur}\n\n${patch}`;
    next = { ...next, script };
  }

  if (writeShots) {
    let shots = [...(next.shots || [])];
    const story = shots.filter((s) => !isTransitionShot(s));

    if (version.shotUpdates?.length) {
      shots = shots.map((s) => {
        if (isTransitionShot(s)) return s;
        const u = version.shotUpdates!.find((x) => x.shotNumber === s.number);
        if (!u) return s;
        return {
          ...s,
          description: u.description?.trim() || s.description,
          dialogue: u.dialogue !== undefined ? u.dialogue : s.dialogue,
          emotion: u.emotion !== undefined ? u.emotion : s.emotion,
          camera: u.camera?.trim() || s.camera,
        };
      });
    }

    // Apply beatChanges onto shots by number when no explicit shotUpdates
    if (!version.shotUpdates?.length && version.beatChanges?.length) {
      for (const beat of version.beatChanges) {
        const nums = beat.shotNumbers || [];
        if (!nums.length && beat.after) {
          // attach first empty story shot
          const empty = story.find((s) => !s.description?.trim());
          if (empty) {
            shots = shots.map((s) =>
              s.id === empty.id ? { ...s, description: beat.after } : s
            );
          }
          continue;
        }
        for (const n of nums) {
          shots = shots.map((s) =>
            !isTransitionShot(s) && s.number === n
              ? {
                  ...s,
                  description: beat.after || s.description,
                  emotion: beat.isTwist ? s.emotion || 'Revelation' : s.emotion,
                }
              : s
          );
        }
      }
    }

    if (version.newShots?.length) {
      const after = version.insertAfterShot ?? Math.max(0, ...story.map((s) => s.number || 0));
      const insertAt = shots.findIndex(
        (s) => !isTransitionShot(s) && (s.number || 0) === after
      );
      const idx = insertAt >= 0 ? insertAt + 1 : shots.length;
      const newOnes: Shot[] = version.newShots.map((ns, i) => ({
        id: `nar-${Date.now().toString(36)}-${i}`,
        number: 0,
        description: ns.description,
        dialogue: ns.dialogue,
        emotion: ns.emotion,
        camera: ns.camera || 'Medium shot',
        duration: Math.min(15, Math.max(3, ns.duration || 6)),
        shotKind: 'story' as const,
      }));
      shots = [...shots.slice(0, idx), ...newOnes, ...shots.slice(idx)];
      // renumber story shots
      let n = 1;
      shots = shots.map((s) => {
        if (isTransitionShot(s)) return s;
        return { ...s, number: n++ };
      });
    }

    next = { ...next, shots };
  }

  return next;
}

export function projectTypeToGenreHint(type: ProjectType): NarrativeGenre {
  if (type === 'sitcom') return 'sitcom';
  if (type === 'anime') return 'anime';
  if (type === 'commercial') return 'drama';
  return 'auto';
}
