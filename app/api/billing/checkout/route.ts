import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { getStripe, isStripeConfigured, appUrl } from '@/lib/stripe';
import {
  PLANS,
  CREDIT_PACKS,
  resolveStripePriceId,
  type PlanId,
  type CreditPackId,
} from '@/lib/plans';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payments not configured yet. Set STRIPE_SECRET_KEY and price IDs to enable checkout.',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const limited = await rateLimit(`checkout:${auth.userId}:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429 });
  }

  const body = await req.json();
  const mode = body.mode as 'subscription' | 'payment';
  const planId = body.planId as PlanId | undefined;
  const packId = body.packId as CreditPackId | undefined;

  if (mode !== 'subscription' && mode !== 'payment') {
    return NextResponse.json({ error: 'mode must be subscription or payment' }, { status: 400 });
  }

  await dbConnect();
  const user = await User.findById(auth.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const stripe = getStripe();

  // Ensure Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.displayName || user.username,
      metadata: {
        userId: user._id.toString(),
        username: user.username,
      },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  let priceId: string | null = null;
  let metadata: Record<string, string> = {
    userId: user._id.toString(),
    username: user.username,
  };

  if (mode === 'subscription') {
    if (!planId || planId === 'free' || !PLANS[planId]) {
      return NextResponse.json({ error: 'Valid paid planId required' }, { status: 400 });
    }
    priceId = resolveStripePriceId(PLANS[planId].stripePriceEnv);
    metadata.planId = planId;
    metadata.kind = 'membership';
  } else {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) return NextResponse.json({ error: 'Valid packId required' }, { status: 400 });
    priceId = resolveStripePriceId(pack.stripePriceEnv);
    metadata.packId = pack.id;
    metadata.credits = String(pack.credits);
    metadata.kind = 'credit_pack';
  }

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          'Stripe Price ID missing for this product. Create products in Stripe and set env vars (STRIPE_PRICE_*).',
        code: 'PRICE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl('/?billing=success'),
    cancel_url: appUrl('/?billing=canceled'),
    client_reference_id: user._id.toString(),
    metadata,
    subscription_data:
      mode === 'subscription'
        ? {
            metadata: {
              userId: user._id.toString(),
              planId: planId || '',
            },
          }
        : undefined,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
