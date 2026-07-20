# MovieDirector.ai — Product Vision & User Journey (2026)

## Core Concept (Billion-Dollar Level)
The AI-native film studio for personal brand creators, studios, and agencies.

**Tagline:** Your films are your feed.

Creators direct cinematic short films, sitcom episodes, brand films, and serialized content using Grok's world-class image + video generation. One project becomes platform-optimized drops + a private subscription channel.

Differentiation:
- Professional-grade directing tools (not toy prompt boxes): structured treatments, per-shot cinematic language (emotion, acting, camera, sound, dialogue).
- Consistency engine: character + style references carried automatically into every generation.
- End-to-end: Concept → Plan → Generate → Assemble → Publish → Monetize.
- Personal brand first: Every film feeds your audience engine (public feed discovery + paid channels).

## Target Users (Early)
- Ambitious creators building personal brands via long-form video.
- Small studios / agencies wanting fast high-quality branded content.
- Early AI film experimenters who want pro control + distribution.

## Complete User Journey (Must Feel Coherent & Magical)

1. **Discover** (Feed / Landing)
   - See real published films from other directors.
   - Click into rich FilmDetailModal (logline, clips?, discussion, rate, message creator).
   - Clear CTA: "Start directing your first film — free"

2. **Onboard & Auth (free forever)**
   - Simple username/password (fast). No card required.
   - On success: open **First Cut** walkthrough (not a blank canvas).

3. **Free First Cut (genius sample)**
   - Choose path: Sitcom pilot · Short film · Commercial · Launch trailer.
   - Answer 3–4 high-signal prompts → auto treatment + short shot list.
   - Platform-sponsored gens: **3 free frames + 2 free video clips**.
   - User gets a real, shareable media sample and can publish to the feed.
   - Pre-production forever free (plan, cast, style, social copy).

3b. **Free trial → paid**
   - After First Cut: offer **7-day Creator trial** (500 credits).
   - Platform trial (no card) and/or Stripe trial ($0 today, card on file).
   - Then paid membership + usage credits (MRR engine).

4. **Create Project (Pre-Production)**
   - Choose type (Sitcom / Film / Commercial / Anime / Brand-Fusion) — each has smart default treatment + shot templates.
   - Title + logline (mandatory).
   - Optional rich concept + style hint.
   - Berserker toggle for unrestrained mode.
   - Instant beautiful treatment + shot list generated.
   - "Begin directing" → workspace.

4. **Direct (Workspace)**
   Tabs that make cinematic sense:
   - **Treatment**: Synopsis, regenerate, high-level notes.
   - **Storyboard**: Detailed shot list (description, camera, duration + advanced: emotion, acting cues, dialogue, sound, cameraDetailed, styleNotes).
   - **Cast**: Characters with rich descriptions + reference images (for consistency).
   - **Style**: Global style reference image + description.
   - **Generate / Clips**: One-click Grok frame + video per shot (or powerful Batch). Smart modes (image-to-video, reference-to-video, extend). Progress + cost.
   - **Voice**: Add VO scripts per shot.
   - **Timeline / Assemble**: Play sequence (with VO), reorder?, preview.
   - **Export / Render**: Full package (clips + manifest + FFmpeg instructions) or real stitched MP4 (via worker).
   - **Publish**: Push to public feed. Auto social tools.
   - **API** (for power users later).

5. **Generate**
   - Prompts are pro-grade (include all cues + references).
   - Backend job system + polling.
   - Assets auto-persisted to permanent URLs (Vercel Blob).
   - Show real cost estimates.

6. **Assemble & Export**
   - Play full sequence.
   - One-click "Render Full Movie" → JSZip professional export package (ready for editor or simple ffmpeg).
   - Future: One-click MP4.

7. **Launch (Distribution)**
   - Publish to main feed (discovery for others).
   - Social Studio: Platform-specific cut suggestions + captions ready to copy.
   - Create / add to Channels: Serialized "show" with subscriber access (monetization path).

8. **Audience & Revenue**
   - Public profile /u/username.
   - Messages with fans/creators.
   - **Platform revenue (primary MRR):** membership plans + usage credits.
   - Channels for creator-side recurring revenue (beta: free subscribe; Stripe Connect later).

## Monetization Principles (Big MRR)
- **Membership fee** = predictable base (Creator / Pro / Studio).
- **Pay-per-use credits** = scales with generation (images + video seconds).
- Free tier exists only to get a film shipped (starter credits), then upgrade.
- Costs always visible before generate; failed gens refund.
- Never surprise charge — wallet + plan is the source of truth.

## Key Experience Principles
- Every screen reinforces "you are a director".
- Defaults are excellent (never start from blank).
- Consistency and quality > quantity of shots.
- Transparent about generation costs and powered-by-Grok.
- Frictionless path to "I just published my first film".
- Pro power users can go deep; new users feel successful fast.

## Current Gaps (Post ship-readiness)
- Channel creator payouts (Stripe Connect).
- Better feed previews and thumbnails.
- Real public API keys + docs.
- End-to-end real-video stitch without external worker (zip export is live).

## Success Metrics for v1 Onboarding
- New user creates project → generates at least 3 clips → publishes → shares profile link in < 15 minutes.
- Demo looks cinematic and inspires "I can do better".

## Tech Notes for Scale
- Next.js + Mongo + Vercel Blob.
- xAI Grok Imagine (images + video) — monitor costs.
- Optional Render worker for heavy stitching.
- Rate limits in place.

This document guides all future changes.
