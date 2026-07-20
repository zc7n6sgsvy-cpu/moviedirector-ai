# MovieDirector.ai - Session Checkpoint

**Date:** 2026-07-14  
**Status:** Ship-ready product layer + monetization wired (awaiting production API keys)

## Connections
- **Vercel:** zc7n6sgsvy-cpu (Acquire Investor projects team) — project `moviedirector`
- **GitHub:** zc7n6sgsvy-cpu/moviedirector-ai
- **Database:** MongoDB (`MONGODB_URI`)
- **Payments:** Stripe (membership + credit packs) — configure via env

## Stable URLs
- Alias: https://moviedirector-psi.vercel.app
- Health: `GET /api/health`

## What is product-complete (code)

### Director console
- Auth (signup/login/password reset)
- Projects with type defaults, treatment, storyboard, cast, style, clips, voice, timeline, publish, API tab
- Grok image + video generation (gated on credits when key present)
- Batch jobs + polling + Blob persistence
- Public feed, likes, comments, ratings, profiles, DMs
- Channels (creator series; subscribe beta free)
- Social Studio + export package / optional Render worker

### Monetization (this session)
- **Membership plans:** Free / Creator $39 / Pro $99 / Studio $299
- **Usage credits:** image 8 cr · video 10 cr/s · packs 200/1000/5000
- Signup grants **120 free credits**
- Stripe Checkout + Customer Portal + Webhook
- Generation returns **402** if insufficient credits (auto-refund on failure)
- Billing UI + landing pricing + credit balance in nav
- Plan-based rate limits + project caps

### Key files
- `lib/plans.ts`, `lib/billing.ts`, `lib/stripe.ts`
- `app/api/billing/*`, `app/api/health`
- `components/BillingPanel.tsx`
- `LAUNCH.md` — full checklist

## Env to go live
See `.env.example` and `LAUNCH.md`.

**Minimum for generation:** `MONGODB_URI`, `JWT_SECRET`, `XAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`  
**Minimum for revenue:** Stripe secret + webhook + 6 price IDs  

## How to resume
```bash
cd /Users/ryan/moviedirector
npm run dev
```
Then: "Continue MovieDirector.ai" or open `LAUNCH.md`.

## Stack
Next.js 16 · MongoDB · Vercel Blob · xAI Grok · Stripe · SendGrid · beehiiv · Upstash · Render worker (optional)
