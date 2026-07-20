import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';

/**
 * Launch readiness probe — safe to call publicly.
 * Does not expose secrets; only boolean capability flags.
 */
export async function GET() {
  const checks = {
    mongodb: Boolean(process.env.MONGODB_URI),
    jwt: Boolean(process.env.JWT_SECRET),
    xai: Boolean(process.env.XAI_API_KEY),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    stripe: isStripeConfigured(),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripePrices: {
      creator: Boolean(process.env.STRIPE_PRICE_CREATOR),
      pro: Boolean(process.env.STRIPE_PRICE_PRO),
      studio: Boolean(process.env.STRIPE_PRICE_STUDIO),
      pack200: Boolean(process.env.STRIPE_PRICE_PACK_200),
      pack1000: Boolean(process.env.STRIPE_PRICE_PACK_1000),
      pack5000: Boolean(process.env.STRIPE_PRICE_PACK_5000),
    },
    upstash: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    sendgrid: Boolean(process.env.SENDGRID_API_KEY),
    beehiiv: Boolean(process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUBLICATION_ID),
    renderWorker: Boolean(process.env.RENDER_WORKER_URL),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };

  const requiredForLaunch = ['mongodb', 'jwt', 'xai', 'blob'] as const;
  const requiredForPayments = ['stripe', 'stripeWebhook'] as const;

  const coreReady = requiredForLaunch.every((k) => checks[k]);
  const paymentsReady =
    checks.stripe &&
    checks.stripeWebhook &&
    Object.values(checks.stripePrices).every(Boolean);

  const status = coreReady ? (paymentsReady ? 'ready' : 'core_ready') : 'not_ready';

  return NextResponse.json({
    ok: coreReady,
    status,
    service: 'moviedirector',
    checks,
    messages: {
      core: coreReady
        ? 'Auth + DB + Grok + Blob configured — generation can run.'
        : 'Missing one of: MONGODB_URI, JWT_SECRET, XAI_API_KEY, BLOB_READ_WRITE_TOKEN',
      payments: paymentsReady
        ? 'Stripe membership + credit packs ready to collect revenue.'
        : 'Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_* env vars to unlock checkout.',
      massOnboarding: coreReady
        ? 'Users can sign up, create projects, generate (with free credits), publish to feed.'
        : 'Complete core env vars before inviting users.',
    },
    timestamp: new Date().toISOString(),
  });
}
