import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { getStripe, isStripeConfigured, appUrl } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments not configured', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });
  }

  await dbConnect();
  const user = await User.findById(auth.userId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing customer yet. Subscribe or buy credits first.' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: appUrl('/?billing=portal'),
  });

  return NextResponse.json({ url: session.url });
}
