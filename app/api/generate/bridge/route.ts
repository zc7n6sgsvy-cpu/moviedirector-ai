import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { editImage, generateImage, generateVideo } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';
import {
  chargeGeneration,
  refundCredits,
  estimateImageCharge,
  estimateVideoCharge,
  type GenQuality,
  InsufficientCreditsError,
  FreeSampleExhaustedError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import {
  type BridgeScanBrief,
  promptFromBridgeScan,
} from '@/lib/bridge-scanner';

export const maxDuration = 300;

/**
 * POST /api/generate/bridge
 * Body:
 *  - projectId, brief: BridgeScanBrief
 *  - stage: 'still' | 'motion'
 *  - quality?: draft | final
 *  - seedImageUrl?: string (for motion)
 *
 * Scanner brief is required — we never invent a bridge without a scan.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan creditBalance');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `gen-bridge:${auth.userId}:${clientIp(req)}`,
    plan.genImagePerHour,
    60 * 60 * 1000
  );
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 503 });
  }

  const body = await req.json();
  const projectId = body.projectId as string;
  const stage = (body.stage || 'still') as 'still' | 'motion';
  const quality: GenQuality = body.quality === 'final' ? 'final' : 'draft';
  const brief = body.brief as BridgeScanBrief | undefined;
  const seedImageUrl = body.seedImageUrl as string | undefined;
  const shotId = body.shotId as string | undefined;

  if (!projectId || !brief) {
    return NextResponse.json({ error: 'projectId and brief (from scanner) required' }, { status: 400 });
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  if (stage === 'still' && !brief.canGenerateStill) {
    return NextResponse.json(
      {
        error: brief.stillBlocker || 'Scan incomplete — generate neighbor frames first',
        code: 'BRIDGE_SCAN_INCOMPLETE',
      },
      { status: 400 }
    );
  }

  const refs = (brief.referenceImageUrls || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3);
  if (stage === 'still' && refs.length === 0) {
    return NextResponse.json(
      {
        error: 'Scanner found no frame URLs to edit from. Generate frames on both shots first.',
        code: 'BRIDGE_NO_REFS',
      },
      { status: 400 }
    );
  }

  const credits =
    stage === 'still'
      ? estimateImageCharge(quality, false)
      : estimateVideoCharge(brief.durationSec || 4, quality, false);

  let chargedAmount = 0;
  try {
    const charge = await chargeGeneration(auth.userId, stage === 'still' ? 'image' : 'video', credits, {
      projectId,
      shotId,
      metadata: { bridge: true, stage, quality, cast: brief.castNames, env: brief.environmentName },
      description: `Bridge ${stage} ${quality} (${credits} cr) · scan-locked`,
    });
    chargedAmount = charge.creditsCharged;

    const prompt = promptFromBridgeScan(brief, stage === 'still' ? 'frame' : 'video');

    if (stage === 'still') {
      let result: { url: string };
      let usedEdit = false;
      try {
        result = await editImage(prompt, refs, '16:9');
        usedEdit = true;
      } catch {
        // Fallback still requires refs mentioned in prompt
        result = await generateImage(
          `${prompt}\nReference frame URLs for identity (describe matching them exactly): ${refs.join(' | ')}`,
          '16:9'
        );
      }
      const stored = await persistRemoteAsset(
        result.url,
        `bridges/${projectId}/${shotId || Date.now()}-still.jpg`
      );
      const refreshed = await User.findById(auth.userId).select('creditBalance');
      return NextResponse.json({
        stage: 'still',
        imageUrl: stored.url,
        usedEdit,
        creditsCharged: chargedAmount,
        creditBalance: refreshed?.creditBalance ?? null,
        freeSample: charge.free,
        briefSummary: {
          cast: brief.castNames,
          environment: brief.environmentName,
          refs: refs.length,
        },
      });
    }

    // motion
    const seed = seedImageUrl || refs[0];
    if (!seed) {
      throw new Error('Bridge motion needs a seed still from the scanner still stage');
    }
    const result = await generateVideo({
      prompt,
      mode: 'image-to-video',
      imageUrl: seed,
      referenceImageUrls: refs,
      duration: Math.min(5, Math.max(2, brief.durationSec || 4)),
    });
    const stored = await persistRemoteAsset(
      result.url,
      `bridges/${projectId}/${shotId || Date.now()}-motion.mp4`
    );
    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      stage: 'motion',
      videoUrl: stored.url,
      creditsCharged: chargedAmount,
      creditBalance: refreshed?.creditBalance ?? null,
      freeSample: charge.free,
    });
  } catch (err) {
    if (chargedAmount > 0) {
      await refundCredits(auth.userId, chargedAmount, {
        description: 'Refund: bridge generation failed',
        projectId,
        shotId,
      }).catch(() => {});
    }
    if (err instanceof FreeSampleExhaustedError || err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err instanceof InsufficientCreditsError
            ? { required: err.required, balance: err.balance, nextStep: err.nextStep }
            : { nextStep: err.nextStep }),
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bridge generation failed' },
      { status: 500 }
    );
  }
}
