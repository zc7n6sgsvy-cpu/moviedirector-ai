/**
 * Style DNA — reusable visual + motion packages for projects.
 *
 * IMPORTANT: We do not clone copyrighted shows. Packs capture *genre energy*
 * (era, medium, comedy grammar) so you can invent original worlds with a
 * similar vibe — e.g. kinetic adult satire like early-2000s limited-animation
 * comedies — without copying characters, logos, or proprietary designs.
 */

export type StyleDnaId =
  | 'kinetic-adult-satire'
  | 'network-multi-cam'
  | 'prestige-single-cam'
  | 'anime-comedy'
  | 'clay-chaos'
  | '3d-toon-feature'
  | 'live-action-sketch'
  | 'noir-sitcom';

export interface StyleDnaPack {
  id: StyleDnaId;
  name: string;
  eyebrow: string;
  tagline: string;
  /** Honest one-liner for users hunting "something like X" */
  resembles: string;
  medium: string;
  /** Injected into project.style.description */
  visualPrompt: string;
  motionPrompt: string;
  comedyGrammar: string;
  colorNotes: string;
  graphicsNotes: string;
  voiceDirection: string;
  bestFor: string[];
}

export const STYLE_DNA_PACKS: StyleDnaPack[] = [
  {
    id: 'kinetic-adult-satire',
    name: 'Kinetic Adult Satire',
    eyebrow: 'LIMITED ANIMATION · CORPORATE CHAOS',
    tagline: 'Flat color, snappy cuts, deadpan gods of industry.',
    resembles:
      'The energy of mid-2000s adult limited-animation satire (think corporate super-villain comedy era) — original characters only.',
    medium: 'Stylized 2D limited animation',
    visualPrompt:
      'Limited-animation adult comedy aesthetic: bold flat color fields, hard graphic silhouettes, simplified anatomy with expressive eyes, occasional Flash-era motion economy, clean vector-ish edges mixed with hand-drawn grit, satirical corporate and media iconography invented for this original show (no logos from real brands or other series). Backgrounds graphic and readable. High contrast. Title cards with punchy kinetic typography.',
    motionPrompt:
      'Snappy limited animation: held poses, sudden whip pans, smash cuts, occasional 2D scale-pops, intentional cheap-but-confident motion. Comedy timing over fluid realism.',
    comedyGrammar:
      'Deadpan monologues, absurd confidence, corporate jargon as poetry, escalating incompetent genius plans, cold opens that feel like trailers for a cult of personality.',
    colorNotes: 'Saturated primaries against muted institutional greys; villain-adjacent accent color as brand of the lead.',
    graphicsNotes:
      'On-screen lower-thirds, fake news chyrons, schematics, "evil plan" whiteboards, parody product UI — all original to this show.',
    voiceDirection:
      'Voices: dry, slightly nasal or iron-rich baritone/alto options; smug certainty; PA announcements; hype-man sidekicks. Not celebrity clones — original vocal textures.',
    bestFor: ['Sitcom pilots', 'Adult animated series', 'Brand parody (original IP)', 'Trailer cold opens'],
  },
  {
    id: 'network-multi-cam',
    name: 'Network Multi-Cam Warmth',
    eyebrow: 'LIVE AUDIENCE ENERGY',
    tagline: 'Bright sets, punchline frames, ensemble chemistry.',
    resembles: 'Classic multi-cam broadcast sitcom grammar without copying any specific show.',
    medium: 'Live-action multi-camera look',
    visualPrompt:
      'Classic multi-cam sitcom lighting: bright practicals, three-walled sets, warm key, soft fill, audience-friendly staging, clean 16:9 coverage.',
    motionPrompt: 'Coverage cuts: wide master, two-shot, singles. Comedy hold on reaction frames.',
    comedyGrammar: 'Setups and buttons, running gags, A/B plots, hug-and-lesson optional.',
    colorNotes: 'Warm practical ambers, cozy interior palettes.',
    graphicsNotes: 'Title card sting, act-in lower thirds.',
    voiceDirection: 'Conversational, punchy delivery, clear diction for dialogue comedy.',
    bestFor: ['Sitcom episodes', 'Workplace comedy'],
  },
  {
    id: 'prestige-single-cam',
    name: 'Prestige Single-Cam',
    eyebrow: 'FILMIC COMEDY-DRAMA',
    tagline: 'Cinematic frames with sitcom structure.',
    resembles: 'Modern single-cam prestige comedies — original world.',
    medium: 'Live-action cinematic',
    visualPrompt:
      'Single-camera cinematic sitcom/drama hybrid: motivated lighting, shallow depth, film grain, location realism, deliberate composition.',
    motionPrompt: 'Steadicam and motivated push-ins; emotional holds.',
    comedyGrammar: 'Awkward silence, character contradiction, cringe with heart.',
    colorNotes: 'Muted naturalistic grades with one accent color.',
    graphicsNotes: 'Minimal, elegant title treatment.',
    voiceDirection: 'Naturalistic overlapping dialogue, soft VO optional.',
    bestFor: ['Short films', 'Character pilots'],
  },
  {
    id: 'anime-comedy',
    name: 'Anime Comedy Punch',
    eyebrow: 'STYLIZED 2D',
    tagline: 'Exaggerated expressions, speed lines, heart.',
    resembles: 'Comedy anime / ONA energy — original designs.',
    medium: 'Anime 2D',
    visualPrompt:
      'Anime comedy key art: clean linework, expressive eyes, stylized hair, dynamic angles, occasional chibi cutaways for jokes.',
    motionPrompt: 'Smear frames, impact holds, snappy takes.',
    comedyGrammar: 'Reaction faces, internal monologue cards, escalating absurdity.',
    colorNotes: 'High-saturation cel shading with soft gradients.',
    graphicsNotes: 'SFX text bursts, thought bubbles as graphic devices.',
    voiceDirection: 'Energetic or deadpan anime-adjacent original voices.',
    bestFor: ['Anime shorts', 'Sitcom hybrids'],
  },
  {
    id: 'clay-chaos',
    name: 'Claymation Chaos',
    eyebrow: 'STOP-MOTION TACTILE',
    tagline: 'Thumbprints, practical sets, weird charm.',
    resembles: 'Adult clay / stop-motion comedy sensibility — original puppets.',
    medium: 'Claymation / stop-motion',
    visualPrompt:
      'Claymation characters with visible texture and thumbprints, miniature practical sets, soft practical lights, slight frame jitter authenticity.',
    motionPrompt: '12fps-feel stop-motion rhythm, held poses, tactile physics.',
    comedyGrammar: 'Physical absurdity, deadpan clay faces, prop comedy.',
    colorNotes: 'Earthy plastics + one neon accent prop.',
    graphicsNotes: 'Hand-crafted title cards, cardboard signage.',
    voiceDirection: 'Slightly processed, intimate mic, quirky original textures.',
    bestFor: ['Shorts', 'Brand films with craft'],
  },
  {
    id: '3d-toon-feature',
    name: '3D Toon Feature',
    eyebrow: 'CG FEATURE LOOK',
    tagline: 'Rounded forms, subsurface skin, big emotional eyes.',
    resembles: 'Feature CG comedy — original designs, not studio IP.',
    medium: '3D CGI cartoon',
    visualPrompt:
      'Feature-quality 3D toon: rounded silhouettes, clean shaders, soft global illumination, expressive eye rigs, readable costume silhouettes.',
    motionPrompt: 'Anticipation, squash/stretch subtle, polished camera moves.',
    comedyGrammar: 'Character contrast pairs, visual gags in depth.',
    colorNotes: 'Polished cinematic grade with pop accents.',
    graphicsNotes: 'Dimensional title logo treatments.',
    voiceDirection: 'Theatrical clarity, warm lead + comic relief contrast.',
    bestFor: ['Family/adult hybrid shorts', 'Trailers'],
  },
  {
    id: 'live-action-sketch',
    name: 'Live Sketch Chaos',
    eyebrow: 'SKETCH / MOCKUMENTARY',
    tagline: 'Handheld, talking heads, breakneck cuts.',
    resembles: 'Sketch and mockumentary comedy grammar.',
    medium: 'Live-action documentary hybrid',
    visualPrompt:
      'Handheld mockumentary: zoom-ins, imperfect framing, real locations, interview eyelines, confessional close-ups.',
    motionPrompt: 'Whip zooms, crash cuts, freeze-frame title callouts.',
    comedyGrammar: 'Confessionals, cutaway reactions, documentary irony.',
    colorNotes: 'Naturalistic, slightly desaturated.',
    graphicsNotes: 'Lower-third name tags, "archival" stamps (fictional).',
    voiceDirection: 'Interview naturalism + VO narrator optional.',
    bestFor: ['Commercial parody', 'Sitcom pilots'],
  },
  {
    id: 'noir-sitcom',
    name: 'Noir Sitcom',
    eyebrow: 'SHADOW COMEDY',
    tagline: 'Venetian blinds, dry VO, moral grey jokes.',
    resembles: 'Neo-noir comedy hybrids — original.',
    medium: 'Live-action or stylized 2D noir',
    visualPrompt:
      'Noir comedy: hard shadows, venetian blind patterns, wet streets, cigarette haze (stylized), high contrast B&W or teal-amber.',
    motionPrompt: 'Slow push-ins, dutch angles used sparingly for jokes.',
    comedyGrammar: 'Hardboiled voiceover that is wrong about everything.',
    colorNotes: 'Monochrome or limited teal/amber.',
    graphicsNotes: 'Typewriter title cards.',
    voiceDirection: 'Low gravel or cool alto narration — original, not celebrity clones.',
    bestFor: ['Short films', 'Trailer cold opens'],
  },
];

export function getStyleDna(id?: string | null): StyleDnaPack | undefined {
  return STYLE_DNA_PACKS.find((p) => p.id === id);
}

export function buildStyleDescriptionFromDna(pack: StyleDnaPack): string {
  return [
    pack.visualPrompt,
    `Motion: ${pack.motionPrompt}`,
    `Comedy grammar: ${pack.comedyGrammar}`,
    `Color: ${pack.colorNotes}`,
    `Graphics: ${pack.graphicsNotes}`,
  ].join(' ');
}
