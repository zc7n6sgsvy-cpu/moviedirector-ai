import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { analyzeImage } from '@/lib/xai';
import {
  chargeCredits,
  refundCredits,
  InsufficientCreditsError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import { DISCOVER_SYSTEM_PROMPT, parseDiscoveryJson } from '@/lib/discover-from-frame';

export const maxDuration = 120;

/** Credits to discover cast/set from one frame (vision) — cheap vs regen */
const DISCOVER_CREDITS = 2;

/**
 * POST /api/generate/discover
 * Scan a generated frame → propose characters + environment to lock.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `discover:${auth.userId}:${clientIp(req)}`,
    Math.max(20, plan.genImagePerHour),
    60 * 60 * 1000
  );
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 503 });
  }

  const body = await req.json();
  const { projectId, imageUrl, shotId } = body as {
    projectId?: string;
    imageUrl?: string;
    shotId?: string;
  };

  if (!projectId || !imageUrl) {
    return NextResponse.json({ error: 'projectId and imageUrl required' }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json({ error: 'imageUrl must be a public https URL' }, { status: 400 });
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let charged = 0;
  try {
    await chargeCredits(auth.userId, DISCOVER_CREDITS, 'image_charge', {
      projectId,
      shotId,
      description: `Discover cast & set from frame (${DISCOVER_CREDITS} cr)`,
      metadata: { kind: 'discover' },
    });
    charged = DISCOVER_CREDITS;

    const prompt = `${DISCOVER_SYSTEM_PROMPT}\n\nAnalyze this production still and extract cast + environment locks as JSON.`;
    const text = await analyzeImage(imageUrl, prompt);
    const discovery = parseDiscoveryJson(text);

    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      discovery,
      creditsCharged: charged,
      creditBalance: refreshed?.creditBalance ?? null,
      imageUrl,
    });
  } catch (err) {
    if (charged > 0) {
      await refundCredits(auth.userId, charged, {
        description: 'Refund: discover failed',
        projectId,
        shotId,
      }).catch(() => {});
    }
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          required: err.required,
          balance: err.balance,
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Discover failed' },
      { status: 500 }
    );
  }
}
