# MovieDirector.ai

![MovieDirector.ai Logo](/public/logo.png)

**The AI film studio. Powered by Grok.**

Create movies, sitcom episodes, brand fusion films, commercials, and anime at unprecedented speed and quality — with real Grok image + video generation under the hood.

**The killer feature:** Launch your films and sitcom episodes as personal brand content. Create once, then instantly generate platform-optimized cuts, captions, hooks, and thumbnails for TikTok, Reels, YouTube Shorts, X, LinkedIn, and more. Your audience discovers your work through social drops — then subscribes to your private channel for the full series.

One vision: **Your films are your feed.** Instead of posts, creators publish episodes. Personal branding at cinematic scale.

## Current State

Fully functional director console (Next.js + MongoDB backend):

- Real user accounts (signup/login with MongoDB + JWT)
- Project creation with rich concept, style template, and detailed shot list
- Character + Style reference system for consistency
- Advanced per-shot prompting (emotion, acting, dialogue, camera, sound cues)
- Generation prompts ready for Grok Imagine (image + video)
- Clip assembly + one-click "Render Full Movie" export package (with manifest + FFmpeg instructions)
- **Main public Feed** — discover everyone's published films
- **Messaging system** — DMs between creators
- Private subscription Channels
- Social Studio for platform-optimized cuts and personal brand drops
- Official logo integrated
- Cinematic dark UI

Stack: Next.js 16 (Vercel) + MongoDB + GitHub (Render for workers if needed)

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

## Next Steps (roadmap)

- Real asset storage + preview of generated mp4s
- Server render endpoint (Remotion or ffmpeg)
- Public API + auth
- "Episode feed" social view
- Prompt memory + style bible per project
- Collaborative rooms

## Production Setup (MongoDB + Vercel + Render if needed)

1. MongoDB Atlas: Create cluster, get connection string.
2. `cp .env.example .env.local` and set MONGODB_URI, JWT_SECRET.
3. `npm run dev` (needs local Mongo or Atlas).
4. On Vercel: Set the same env vars for the project (acquire-investors-projects/moviedirector).
5. For heavy background (e.g. video queues later): Deploy a worker to Render.com.

Accounts now real via /api/auth/* 
Main Feed via /api/feed + publish.

For scale to 5k-10k: 
- Mongo Atlas handles reads/writes.
- Vercel API routes + edge for most.
- Use Render for async workers if Grok gen volume high.
- Add rate limits, pagination on feed.
- Monitor xAI costs.

