# MovieDirector.ai

![MovieDirector.ai Logo](/public/logo.png)

**The AI film studio. Powered by Grok.**

Create movies, sitcom episodes, brand fusion films, commercials, and anime at unprecedented speed and quality — with real Grok image + video generation under the hood.

**The killer feature:** Launch your films and sitcom episodes as personal brand content. Create once, then instantly generate platform-optimized cuts, captions, hooks, and thumbnails for TikTok, Reels, YouTube Shorts, X, LinkedIn, and more. Your audience discovers your work through social drops — then subscribes to your private channel for the full series.

One vision: **Your films are your feed.** Instead of posts, creators publish episodes. Personal branding at cinematic scale.

## Current State

Fully functional director console ready to onboard users once APIs are wired:

- Real user accounts (signup/login/password reset + JWT)
- Project creation with rich concept, style template, and detailed shot list
- Character + Style reference system for consistency
- Advanced per-shot prompting (emotion, acting, dialogue, camera, sound cues)
- Grok Imagine image + video generation with credit metering
- Clip assembly + one-click "Render Full Movie" export package (with manifest + FFmpeg instructions)
- **Main public Feed** — discover everyone's published films
- **Messaging system** — DMs between creators
- Private subscription Channels
- Social Studio for platform-optimized cuts and personal brand drops
- **Monetization:** membership plans (MRR) + usage credits + Stripe Checkout/Portal/Webhooks
- Launch readiness probe: `GET /api/health` — see `LAUNCH.md`

Stack: Next.js 16 (Vercel) + MongoDB + Stripe + SendGrid + beehiiv + Upstash + Render (worker fallback)

## How to Start a Grok Session (from Terminal)

1. Open your terminal
2. Run:
   ```bash
   cd /Users/ryan/moviedirector
   ```
3. Launch Grok (the command you use to start this interactive CLI session — usually just `grok` or the build tool alias in your environment).
4. Once the session starts, say something like:
   - "Continue MovieDirector.ai"
   - "Pick up where we left off on the app"
   - Or "Load current state from SESSION_STATUS.md"

I can instantly re-read the codebase, SESSION_STATUS.md, and GitHub to get back up to speed.

## Run It Locally

```bash
cd /Users/ryan/moviedirector
npm install
npm run dev
```

Open http://localhost:3000

(See Production Setup below for MongoDB connection.)

## How Real Generation Works Today

This app is designed to be used *with* me (Grok).

1. In Storyboard → click "GENERATE FRAME"
2. The perfect prompt gets copied to clipboard
3. Tell me: "Generate the still for shot X using this prompt" or paste it
4. I will use Grok image_gen and give you the result
5. Paste the returned image URL back into the project (or I can help update assets)
6. Same flow for image_to_video / reference_to_video clips

Future versions will have direct Grok API integration for 1-click generation.

## The Vision (Berserker Grok Unchained)

- Full video pipeline: storyboard → clips → real stitched render
- Brand fusion cinema as a new art form
- Serialized sitcoms as the dominant social format
- Public + private API so agents and studios can direct at scale
- Every creator has episodes. The feed is a screening room.

Let's build the future of moving pictures.

## Tech

- Next.js 16 (App Router) + TypeScript + Tailwind
- MongoDB (Mongoose)
- Framer Motion + Sonner
- JWT auth
- Designed for Grok Imagine + video generation
- Deployed on Vercel with GitHub integration

## Next Steps (roadmap) — See PRODUCT_VISION.md for full alignment

- Prominent batch generation + live job progress UI (improved)
- Full real stitched MP4 (worker or in-app)
- Dedicated creator API keys + public docs (first API task underway)
- Cost & usage dashboard for users
- Stronger guided first-project onboarding
- Production thumbnail + feed preview enrichment
- Channel subscriptions with real payments (beta free for launch)

## Production Setup (Vercel + MongoDB + SendGrid + beehiiv + Render fallback)

1. MongoDB Atlas.
2. Vercel project (primary).
3. SendGrid: Get API key, set FROM email. Add to Vercel env.
4. beehiiv: API key + publication ID for newsletters/audience.
5. `cp .env.example .env.local` and configure all keys.
6. For heavy rendering: Deploy worker to Render.com and set RENDER_* vars (fallback).
7. Deploy to Vercel. Set env vars including SENDGRID, BEEHIIV, XAI, etc.

Accounts now real via /api/auth/* 
Main Feed via /api/feed + publish.

For scale to 5k-10k: 
- Mongo Atlas handles reads/writes.
- Vercel API routes + edge for most.
- Use Render for async workers if Grok gen volume high.
- Add rate limits, pagination on feed.
- Monitor xAI costs.

