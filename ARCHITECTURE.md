# MovieDirector.ai Architecture

This document exists so future you (or agents) can quickly internalize the entire system.

## High-Level Layers

1. **Presentation Layer**
   - Next.js App Router
   - Single massive but well-organized client component: `app/page.tsx`
   - View router: `currentView` (landing, dashboard, workspace, feed, social, channels, ideas, messages, profile)
   - Inside workspace: `activeTab` (treatment, storyboard, clips, cast, voice, timeline, publish, api)

2. **API Layer** (`app/api/`)
   - All routes are protected by `requireAuth` (JWT)
   - Heavy use of rate limiting (Upstash or in-memory)
   - Project ownership verified via `verifyProjectAccess`
   - Long-running work uses Job documents + polling (`/generate/jobs`, `/render`)

3. **Service / Lib Layer** (`lib/`)
   - `xai.ts` — Thin client to Grok Imagine (image + video + extensions)
   - `generation-worker.ts` — The real brain. Processes jobs, chooses generation mode, pulls references, persists assets
   - `prompts.ts` — All the sophisticated prompt engineering (centralized)
   - `storage.ts` — Vercel Blob permanence layer
   - `auth.ts`, `project-auth.ts`, `rate-limit.ts`
   - `cost.ts`

4. **Data Layer** (Mongoose)
   - User, Project, FeedItem, Channel, ChannelSubscription
   - GenerationJob, RenderJob (for async work)
   - Message, Comment, Like, Rating

## Core Flows (Internalize These)

### Film Creation Flow
1. Create Project (strong type-based defaults from DEFAULT_TREATMENTS)
2. Edit in Workspace tabs (advanced per-shot fields are gold)
3. Generate frames → then video (or batch)
4. Worker picks best mode using previous clips + references
5. Assets go through persistRemoteAsset → permanent URLs
6. Assemble (timeline) → Export (zip or real render job)

### Generation Intelligence
- Prompts are extremely rich (project context + style + all per-shot cues + character refs + berserker + type flavor)
- Worker decides: text-to-video / image-to-video / reference-to-video / extend-video
- Always tries to maintain "one consistent world"

### Publishing & Distribution
- `/api/publish` → FeedItem + marks project public
- Feed supports comments, likes, ratings
- Channels = serialized shows with (future) paid access
- Social Studio helps turn one film into many platform drops

## Important Design Decisions

- **Everything is client-heavy right now** (good for speed of iteration, will need hydration later)
- **Jobs are the source of truth for long work** — UI polls them
- **Assets must be persisted** — Grok URLs expire
- **Prompts are the product** — moving them to `lib/prompts.ts` was critical
- Demo projects use `demo-` prefix (intentionally not valid ObjectIds)

## Billing Architecture

1. **Catalog** — `lib/plans.ts` (memberships + credit packs + credit costs)
2. **Ledger** — `models/UsageEvent.ts` + atomic charge/grant/refund in `lib/billing.ts`
3. **User wallet** — `User.creditBalance`, `plan`, `stripeCustomerId`, `stripeSubscriptionId`
4. **Collection** — Stripe Checkout (subscription + one-time packs), Portal, Webhook
5. **Gates** — `/api/generate/*` charge before calling xAI; 402 if broke; refund on failure
6. **UI** — `BillingPanel`, landing pricing, credit chip in header

## Current Weak Points (Known)

- Monolithic page.tsx
- Real video stitching still depends on optional external worker
- Channel creator payouts not live (subscribe remains free beta)
- Public API keys still placeholder (`lib/api-auth.ts`)

## Next Big Levers

- Stripe Connect for channel subscriptions (platform take-rate)
- Split page.tsx into route segments
- Annual plans + promo codes campaigns
- Usage analytics dashboard for Studio tier

Update this file whenever you change major architecture.
