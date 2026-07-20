# MovieDirector.ai — Launch Checklist

Goal: ship a product that works end-to-end the moment APIs are wired, and collect **membership MRR + usage revenue**.

## Revenue model (configured in code)

| Stream | What users pay | Where |
|--------|----------------|-------|
| **Membership** | Free / Creator $39 / Pro $99 / Studio $299 per month | Stripe Checkout `mode=subscription` |
| **Usage** | Credits (image 8 cr, video 10 cr/s). Packs $19 / $79 / $299 | Stripe Checkout `mode=payment` |
| **Channels** | Creator-set prices (beta free subscribe) | Future Stripe Connect |

Included monthly credits on paid plans renew via `invoice.paid` webhook.

## Core path (must work for mass onboarding)

### Free → trial → paid funnel (First Cut)

1. Land → **Create your free First Cut** (no card)
2. Signup → First Cut walkthrough opens automatically
3. Pick path: **Sitcom pilot · Short film · Commercial · Launch trailer**
4. Answer 3–4 prompts → sample project auto-built
5. Generate with **platform free allowance**: 3 frames + 2 video clips (not wallet credits)
6. Publish sample to feed (optional social proof)
7. **Start 7-day Creator free trial** (500 credits) — platform no-card *or* Stripe trial
8. Full generation / batch / paid membership + credit packs after trial

Target: **first real sample asset in under 15 minutes**, then trial conversion.

Pre-production (treatments, shots, cast, style, social copy) stays free forever.

## Required env vars for generation

```
MONGODB_URI=
JWT_SECRET=
XAI_API_KEY=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_APP_URL=
```

Optional but recommended for scale:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
BEEHIIV_API_KEY=
BEEHIIV_PUBLICATION_ID=
RENDER_WORKER_URL=
RENDER_WORKER_SECRET=
```

## Required env vars for payments (MRR)

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_CREATOR=
STRIPE_PRICE_PRO=
STRIPE_PRICE_STUDIO=
STRIPE_PRICE_PACK_200=
STRIPE_PRICE_PACK_1000=
STRIPE_PRICE_PACK_5000=
```

### Stripe setup steps

1. Create Products in Stripe:
   - Creator / Pro / Studio → **recurring monthly** prices matching `$39 / $99 / $299`
   - Credit packs → **one-time** prices `$19 / $79 / $299`
2. Copy each **Price ID** into the env vars above
3. Add webhook endpoint: `https://YOUR_DOMAIN/api/billing/webhook`
4. Subscribe events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Enable Customer Portal (for cancel / invoices / card update)

## Readiness probe

```
GET /api/health
```

- `status: "ready"` → core + Stripe fully configured  
- `status: "core_ready"` → users can generate with free credits; checkout pending Stripe  
- `status: "not_ready"` → missing Mongo / JWT / XAI / Blob  

## API surface for money

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/billing/plans` | Public catalog |
| GET | `/api/billing/account` | Balance, plan, usage log |
| POST | `/api/billing/checkout` | `{ mode, planId \| packId }` → Stripe URL |
| POST | `/api/billing/portal` | Stripe customer portal |
| POST | `/api/billing/webhook` | Stripe events (raw body) |

Generation routes return **402** + `INSUFFICIENT_CREDITS` when balance is too low (UI routes to Billing).

## Pre-launch smoke test

- [ ] `npm run build` succeeds  
- [ ] `/api/health` returns expected flags  
- [ ] Signup grants 120 credits  
- [ ] With `XAI_API_KEY`, image + video succeed and debit credits  
- [ ] Failed gen refunds credits  
- [ ] Stripe test mode: subscribe Creator → plan + credits  
- [ ] Stripe test mode: buy pack → balance increases  
- [ ] Portal opens for subscribed customer  
- [ ] Publish film to feed as new user  
- [ ] Rate limits kick in under abuse  

## Deploy notes

- Vercel: set all env vars for Production + Preview  
- Webhook must hit **production** domain (or Stripe CLI for local)  
- Never commit real secrets  
- After deploy, hit `/api/health` once and screenshot for the launch channel  

## Not blockers for v1 (document as beta)

- Channel creator payouts (subscribe is free beta)  
- Real one-click MP4 without Render worker (zip export works)  
- Public API keys (`lib/api-auth.ts` placeholder)  
- Splitting monolithic `app/page.tsx`  

When core + Stripe env are set, this product is **ready to onboard mass users and collect revenue**.
