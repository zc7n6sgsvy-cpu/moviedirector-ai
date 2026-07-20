import { NextResponse } from 'next/server';
import { planList, CREDIT_PACKS, CREDIT_COSTS, isStripeConfigured } from '@/lib/plans-public';

export async function GET() {
  // Re-export from a thin public helper to avoid pulling Stripe secrets into this route.
  return NextResponse.json({
    plans: planList(),
    creditPacks: CREDIT_PACKS.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      priceUsd: p.priceUsd,
      bestValue: !!p.bestValue,
      perCreditUsd: Math.round((p.priceUsd / p.credits) * 1000) / 1000,
    })),
    costs: {
      imageCredits: CREDIT_COSTS.image,
      videoCreditsPerSecond: CREDIT_COSTS.videoPerSecond,
      video8sCredits: CREDIT_COSTS.videoPerSecond * 8,
    },
    paymentsReady: isStripeConfigured(),
  });
}
