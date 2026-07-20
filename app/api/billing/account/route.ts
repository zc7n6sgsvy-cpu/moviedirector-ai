import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { requireAuth } from '@/lib/auth';
import { getBillingSnapshot } from '@/lib/billing';
import { planList, CREDIT_PACKS, CREDIT_COSTS } from '@/lib/plans';
import { isStripeConfigured } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const snapshot = await getBillingSnapshot(auth.userId);
  if (!snapshot) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    ...snapshot,
    catalog: {
      plans: planList().map((p) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        priceMonthlyUsd: p.priceMonthlyUsd,
        monthlyCredits: p.monthlyCredits,
        signupCredits: p.signupCredits,
        maxProjects: p.maxProjects,
        features: p.features,
        highlighted: !!p.highlighted,
      })),
      creditPacks: CREDIT_PACKS.map((p) => ({
        id: p.id,
        name: p.name,
        credits: p.credits,
        priceUsd: p.priceUsd,
        bestValue: !!p.bestValue,
      })),
      costs: {
        imageCredits: CREDIT_COSTS.image,
        videoCreditsPerSecond: CREDIT_COSTS.videoPerSecond,
      },
    },
    paymentsReady: isStripeConfigured(),
  });
}
