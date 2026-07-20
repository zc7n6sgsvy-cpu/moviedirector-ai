import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { startPlatformTrial, getBillingSnapshot } from '@/lib/billing';
import { getStripe, isStripeConfigured, appUrl } from '@/lib/stripe';
import { PLANS, resolveStripePriceId } from '@/lib/plans';
import { TRIAL_DAYS, TRIAL_CREDITS, TRIAL_PLAN } from '@/lib/first-cut';

/**
 * Start 7-day Creator trial.
 *
 * body.mode:
 *  - "platform" (default): instant trial in our DB (no card). Good for launch + when Stripe missing.
 *  - "stripe": Checkout subscription with trial_period_days (card on file, $0 until trial ends).
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`trial:${auth.userId}:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const mode = (body.mode as string) || 'platform';

  await dbConnect();
  const user = await User.findById(auth.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.planStatus === 'trialing' && user.trialEndsAt && user.trialEndsAt > new Date()) {
    const snapshot = await getBillingSnapshot(auth.userId);
    return NextResponse.json({
      ok: true,
      alreadyOnTrial: true,
      trialEndsAt: user.trialEndsAt,
      creditBalance: user.creditBalance,
      account: snapshot,
    });
  }

  if (user.hasUsedTrial && !(user.planStatus === 'trialing')) {
    return NextResponse.json(
      {
        error: 'You already used your free trial. Upgrade to Creator or buy credits.',
        code: 'TRIAL_USED',
        nextStep: 'upgrade',
      },
      { status: 403 }
    );
  }

  // Prefer Stripe Checkout trial when requested + configured
  if (mode === 'stripe') {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Stripe not configured', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    const priceId = resolveStripePriceId(PLANS[TRIAL_PLAN].stripePriceEnv);
    if (!priceId) {
      return NextResponse.json(
        { error: 'Creator price not configured', code: 'PRICE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.displayName || user.username,
        metadata: { userId: user._id.toString(), username: user.username },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: appUrl('/?billing=trial_success&trial=1'),
      cancel_url: appUrl('/?billing=trial_canceled'),
      client_reference_id: user._id.toString(),
      metadata: {
        userId: user._id.toString(),
        planId: TRIAL_PLAN,
        kind: 'trial_membership',
      },
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          userId: user._id.toString(),
          planId: TRIAL_PLAN,
          trial: 'true',
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      ok: true,
      mode: 'stripe',
      url: session.url,
      sessionId: session.id,
      trialDays: TRIAL_DAYS,
    });
  }

  // Platform trial (instant, no card)
  try {
    const updated = await startPlatformTrial(auth.userId);
    const snapshot = await getBillingSnapshot(auth.userId);
    return NextResponse.json({
      ok: true,
      mode: 'platform',
      plan: updated.plan,
      planStatus: updated.planStatus,
      trialEndsAt: updated.trialEndsAt,
      creditBalance: updated.creditBalance,
      trialCredits: TRIAL_CREDITS,
      trialDays: TRIAL_DAYS,
      account: snapshot,
      message: `Creator trial active for ${TRIAL_DAYS} days with ${TRIAL_CREDITS} credits. No card required.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start trial' },
      { status: 400 }
    );
  }
}
