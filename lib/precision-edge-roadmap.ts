/**
 * Precision edge roadmap — builds that widen MD vs Kling / Higgs / Seedance.
 * Not all shipped; product prioritization for “accuracy over randoms.”
 */

export type EdgeBuild = {
  id: string;
  title: string;
  why: string;
  vsKlingHiggs: string;
  effort: 'S' | 'M' | 'L';
  status: 'shipped' | 'next' | 'later';
};

export const PRECISION_EDGE_BUILDS: EdgeBuild[] = [
  {
    id: 'marketing-studio',
    title: 'Marketing Studio (short-form / ads)',
    why: 'Timed beats + brand never-list + CTA — ads with the same precision as pilots.',
    vsKlingHiggs: 'They generate ads; we plan offer → beats → cast → spend.',
    effort: 'M',
    status: 'shipped',
  },
  {
    id: 'shot-lock',
    title: 'Shot lock + spend gate',
    why: 'Lock a shot after Lab approval; FINAL gens require lock. Stops accidental burns.',
    vsKlingHiggs: 'No concept of “approved for final spend.”',
    effort: 'S',
    status: 'next',
  },
  {
    id: 'look-bible',
    title: 'Look bible / model sheet board',
    why: 'Grid of cast + location stills that every prompt must match.',
    vsKlingHiggs: 'Elements/Soul ID = look; we need multi-character episode board.',
    effort: 'M',
    status: 'next',
  },
  {
    id: 'dialogue-pass',
    title: 'Dialogue pass (read-through)',
    why: 'Play all VO/dialogue in order before any video gen.',
    vsKlingHiggs: 'Audio after gen; we validate script first (free).',
    effort: 'S',
    status: 'next',
  },
  {
    id: 'consistency-score',
    title: 'Consistency score per gen',
    why: 'After frame returns, score vs ref (simple embedding/heuristic) + cheap retake suggest.',
    vsKlingHiggs: 'They show pretty clips; we show “this drifted from Alex.”',
    effort: 'L',
    status: 'later',
  },
  {
    id: 'act-structure',
    title: 'Act / cold-open structure templates',
    why: 'Sitcom A/B/C plot boards with timing budgets (7 min pilot template).',
    vsKlingHiggs: 'Multi-shot is 6 clips; we are episode architecture.',
    effort: 'M',
    status: 'next',
  },
  {
    id: 'brand-kit-global',
    title: 'Global brand kit (company-level)',
    why: 'Reuse brand across many ad projects like The Company for cast.',
    vsKlingHiggs: 'Per-project prompts; we are multi-spot campaigns.',
    effort: 'M',
    status: 'later',
  },
  {
    id: 'variant-matrix',
    title: 'A/B variant matrix',
    why: 'Same locked plan, 3 CTA/hook variants, draft-only spend comparison.',
    vsKlingHiggs: 'Manual re-prompt; we systematize tests under one brand kit.',
    effort: 'M',
    status: 'next',
  },
  {
    id: 'edit-decision-list',
    title: 'EDL / cut decision list',
    why: 'Mark keep/drop/bridge per shot before AI assemble.',
    vsKlingHiggs: 'Export dump; we direct the cut.',
    effort: 'S',
    status: 'next',
  },
  {
    id: 'pilot-budget-meter',
    title: 'Pilot budget meter',
    why: 'Live “min remaining on Creator” + “this spot costs X draft/Y final.”',
    vsKlingHiggs: 'Opaque credits; we speak finished minutes.',
    effort: 'S',
    status: 'next',
  },
  {
    id: 'byo-key',
    title: 'BYO xAI key (power users)',
    why: 'Feature-length burners pay API direct; MD keeps director OS margin.',
    vsKlingHiggs: 'Closed credit economy only.',
    effort: 'L',
    status: 'later',
  },
  {
    id: 'multi-model-draft',
    title: 'Optional cheap draft model',
    why: 'Draft on cheaper model, final on Grok — only if we add multi-provider.',
    vsKlingHiggs: 'They already multi-model; we stay Grok-final for quality brand.',
    effort: 'L',
    status: 'later',
  },
];
