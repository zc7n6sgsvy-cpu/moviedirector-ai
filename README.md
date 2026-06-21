# MovieDirector.ai

**The AI film studio. Powered by Grok.**

Create movies, sitcom episodes, brand fusion films, commercials, and anime at unprecedented speed and quality — with real Grok image + video generation under the hood.

**The killer feature:** Launch your films and sitcom episodes as personal brand content. Create once, then instantly generate platform-optimized cuts, captions, hooks, and thumbnails for TikTok, Reels, YouTube Shorts, X, LinkedIn, and more. Your audience discovers your work through social drops — then subscribes to your private channel for the full series.

One vision: **Your films are your feed.** Instead of posts, creators publish episodes. Personal branding at cinematic scale.

## Current State — Ambitious Starter

Fully functional director console built in Next.js:

- Project creation with type (Sitcom / Film / Commercial / Anime / Brand-Fusion)
- **Berserker Mode** — Unchained creative mode, no limits
- Intelligent treatment + shot breakdown generation
- Interactive Storyboard with shot editing
- "Generate Frame" → produces perfect Grok Imagine prompts (copy & use with me)
- Clip Lab: Turn stills into video (using Grok video tech)
- Drag-friendly Timeline + live sequence playback
- Rich captions, VO, reordering
- Export cut JSON
- **Social Studio**: One-click platform cuts (9:16/16:9), AI captions + hashtags, thumbnail prompts, personal brand packs
- Publish + Private Subscription Channels
- Strong Director API surface + example
- Cinematic dark UI with gold/crimson accents, film grain

## Run It

```bash
cd moviedirector
npm install
npm run dev
```

Open http://localhost:3000

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

- Next.js 16 + TypeScript + Tailwind
- Framer Motion + Sonner
- Local-first (localStorage persistence for now)
- Designed for Grok Imagine + video generation

## Next Steps (roadmap)

- Real asset storage + preview of generated mp4s
- Server render endpoint (Remotion or ffmpeg)
- Public API + auth
- "Episode feed" social view
- Prompt memory + style bible per project
- Collaborative rooms
