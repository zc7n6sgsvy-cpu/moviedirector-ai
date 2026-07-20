/**
 * Guided product tour steps for MovieDirector.ai
 * Each step can navigate to a view/tab and explain a feature.
 */

export type TourView =
  | 'landing'
  | 'dashboard'
  | 'workspace'
  | 'channels'
  | 'ideas'
  | 'social'
  | 'feed'
  | 'messages'
  | 'billing';

export type TourTab =
  | 'treatment'
  | 'storyboard'
  | 'clips'
  | 'cast'
  | 'voice'
  | 'timeline'
  | 'publish'
  | 'api';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  view: TourView;
  tab?: TourTab;
  /** Highlight nav label for orientation */
  navHint?: string;
  /** Section within the funnel story */
  chapter: string;
}

export const PRODUCT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    chapter: 'Overview',
    title: 'Welcome to MovieDirector.ai',
    body: 'This is the AI film studio for personal brand cinema. You discover films on the feed, direct projects with Grok image + video, publish publicly, and grow via channels + paid plans. This tour walks every major surface — click Next to move.',
    view: 'landing',
    navHint: 'Landing',
  },
  {
    id: 'landing-first-cut',
    chapter: 'Free funnel',
    title: 'Free First Cut CTA',
    body: 'Primary conversion: "Create your free First Cut" — no card. Walkthrough paths: sitcom pilot, short film, brand commercial, or launch trailer. Users get 5 free frames + 3 free video clips as a real sample asset, then a trial with real volume.',
    view: 'landing',
    navHint: 'Landing hero',
  },
  {
    id: 'landing-pricing',
    chapter: 'Free funnel',
    title: 'Pricing on the landing page',
    body: 'Membership plans (Free / Creator $39 / Pro $99 / Studio $299) plus credit packs. Free = planning + First Cut sample. Paid = monthly credits + full generation. Scroll the landing cards, then continue.',
    view: 'landing',
    navHint: 'Pricing',
  },
  {
    id: 'billing',
    chapter: 'Money',
    title: 'Billing & membership',
    body: 'Wallet, plan status, First Cut funnel CTAs, 7-day free trial, Stripe Checkout for plans/packs, customer portal, and usage ledger. Generation charges credits (or free First Cut allowance). Failed gens auto-refund.',
    view: 'billing',
    navHint: 'Pricing / credits',
  },
  {
    id: 'dashboard',
    chapter: 'Studio home',
    title: 'The Vault (Projects)',
    body: 'All your productions live here. Onboarding banner shows First Cut status, free sample gens left, trial state, and credit balance. Create a new production or open an existing one to enter the director workspace.',
    view: 'dashboard',
    navHint: 'Projects',
  },
  {
    id: 'feed',
    chapter: 'Discovery',
    title: 'Public Feed',
    body: 'Discover films other directors published. Open a film for logline, likes, comments, ratings, and messaging the creator. This is how new users get inspired — and how your work gets found.',
    view: 'feed',
    navHint: 'Feed',
  },
  {
    id: 'social',
    chapter: 'Distribution',
    title: 'Social Studio',
    body: 'Turn one film into platform-optimized drops: TikTok/Reels hooks, Shorts, captions, thumbnail prompts, cut plans. "Your films are your feed" — personal brand distribution without a separate tool.',
    view: 'social',
    navHint: 'Social',
  },
  {
    id: 'ideas',
    chapter: 'Ideation',
    title: 'Idea Lab',
    body: 'Brainstorm sitcom premises, commercial variants, and series concepts before you commit a full project. Fast creative sparring partner for directors.',
    view: 'ideas',
    navHint: 'Idea Lab',
  },
  {
    id: 'messages',
    chapter: 'Community',
    title: 'Messages (DMs)',
    body: 'Direct messages between creators and fans. Search users, open threads, collaborate or answer fans after they discover you on the feed.',
    view: 'messages',
    navHint: 'Messages',
  },
  {
    id: 'channels',
    chapter: 'Monetize audience',
    title: 'Channels (series)',
    body: 'Serialize films/episodes into a private channel with a price (subscribe is free beta today). Future: creator payouts via Stripe Connect. Path: Publish project → add to channel → grow subscribers.',
    view: 'channels',
    navHint: 'Channels',
  },
  {
    id: 'ws-treatment',
    chapter: 'Director workspace',
    title: 'Workspace · Concept Laboratory',
    body: 'The Lab is pre-production: World Bible (setting, tone, visual laws), Script Control (master teleplay + push dialogue onto shots), Character Direction (objectives, arcs, how to play them), Continuity Desk, and a readiness score before you burn generation. Not a toy prompt box.',
    view: 'workspace',
    tab: 'treatment',
    navHint: 'LAB tab',
  },
  {
    id: 'ws-storyboard',
    chapter: 'Director workspace',
    title: 'Workspace · Storyboard',
    body: 'Shot list with cinematic controls: description, camera, duration, dialogue from Script Control, emotion, acting cues, sound, detailed camera notes. This is pro directing language — not a single prompt box.',
    view: 'workspace',
    tab: 'storyboard',
    navHint: 'Storyboard tab',
  },
  {
    id: 'ws-cast',
    chapter: 'Director workspace',
    title: 'Workspace · Ensemble Atelier',
    body: 'Style DNA packs (including Kinetic Adult Satire for limited-animation corporate chaos energy), Persona Forge across mediums (live action, 2D, 3D, clay…), The Company repertory library, and Voice Lab for original alternate voices — never IP clones. Tag cast on shots for consistency.',
    view: 'workspace',
    tab: 'cast',
    navHint: 'Ensemble tab',
  },
  {
    id: 'ws-clips',
    chapter: 'Director workspace',
    title: 'Workspace · Generate / Clips',
    body: 'The money feature: Grok Imagine frames + video (text-to-video, image-to-video, reference-to-video, extend). Batch queue + job polling. First Cut free gens or paid credits. Costs shown before you spend.',
    view: 'workspace',
    tab: 'clips',
    navHint: 'Clips tab',
  },
  {
    id: 'ws-voice',
    chapter: 'Director workspace',
    title: 'Workspace · Voice',
    body: 'Per-shot voiceover scripts for assembly and export. Layer VO planning onto the timeline so the cut feels finished even before audio AI is fully wired.',
    view: 'workspace',
    tab: 'voice',
    navHint: 'Voice tab',
  },
  {
    id: 'ws-timeline',
    chapter: 'Director workspace',
    title: 'Workspace · Timeline / Assemble',
    body: 'Play the full sequence, batch-generate remaining clips, cost estimate in credits, and Render Full Movie — ZIP export package (clips + manifest + ffmpeg) or optional Render worker MP4.',
    view: 'workspace',
    tab: 'timeline',
    navHint: 'Timeline tab',
  },
  {
    id: 'ws-publish',
    chapter: 'Director workspace',
    title: 'Workspace · Publish & monetize',
    body: 'Push to the main public feed, share tools, add the film to your channels. End of the journey: Discover → Create → Generate → Publish → Grow.',
    view: 'workspace',
    tab: 'publish',
    navHint: 'Publish tab',
  },
  {
    id: 'ws-api',
    chapter: 'Director workspace',
    title: 'Workspace · Director API',
    body: 'Power-user surface: programmatic project + batch generation examples. Foundation for studio automation and agent workflows. API keys can expand later.',
    view: 'workspace',
    tab: 'api',
    navHint: 'API tab',
  },
  {
    id: 'close',
    chapter: 'Next steps',
    title: 'You have the full map',
    body: 'Recommended live path: Sign up → First Cut walkthrough → generate free sample → publish → start 7-day trial → full project. Use Take the tour anytime from the header. Build features with real keys (XAI + Stripe) when ready.',
    view: 'landing',
    navHint: 'Done',
  },
];
