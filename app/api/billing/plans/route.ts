import { NextResponse } from 'next/server';
import { planList, CREDIT_PACKS, CREDIT_COSTS, isStripeConfigured } from '@/lib/plans-public';

export async function GET() {
  // Re-export from a thin public helper to avoid pulling Stripe secrets into this route.
  return NextResponse.json({
    plans: planList().map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      priceMonthlyUsd: p.priceMonthlyUsd,
      monthlyCredits: p.monthlyCredits,
      signupCredits: p.signupCredits,
      maxProjects: p.maxProjects,
      features: p.features,
      highlighted: p.highlighted,
      episodePromise: p.episodePromise,
    })),
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
      imageDraft: CREDIT_COSTS.imageDraft,
      videoDraftPerSecond: CREDIT_COSTS.videoDraftPerSecond,
      videoCreditsPerSecond: CREDIT_COSTS.videoPerSecond,
      video8sCredits: CREDIT_COSTS.videoPerSecond * 8,
      video5sDraft: CREDIT_COSTS.videoDraftPerSecond * 5,
    },
    episodeEconomics: {
      xaiVideoPerSecUsd: 0.05,
      pure15MinCogsUsd: 45,
      pure25MinCogsUsd: 75,
      note: 'A 15-min continuous Grok clip costs ~$45 in API alone. Plans sell finished-minute budgets + hybrid sitcom tools.',
    },
    paymentsReady: isStripeConfigured(),
  });
}
