import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { generateVideo } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';
import {
  chargeGeneration,
  refundCredits,
  estimateVideoCharge,
  effectiveVideoDuration,
  isShotRetake,
  type GenQuality,
  InsufficientCreditsError,
  FreeSampleExhaustedError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import Project from '@/models/Project';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan creditBalance');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `gen-video:${auth.userId}:${clientIp(req)}`,
    plan.genVideoPerHour,
    60 * 60 * 1000
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec },
      { status: 429 }
    );
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured on server' }, { status: 503 });
  }

  const body = await req.json();
  const {
    prompt,
    imageUrl,
    videoUrl,
    referenceImageUrls,
    referenceVoiceIds,
    duration,
    mode,
    projectId,
    shotId,
    resolution,
    aspectRatio,
  } = body;
  const quality: GenQuality = body.quality === 'draft' ? 'draft' : 'final';

  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const projectDoc = await Project.findById(projectId).select('shots').lean();
  const isRetake = isShotRetake(projectDoc as { shots?: Array<{ id?: string; videoUrl?: string }> }, shotId, 'video');
  const effectiveDuration = effectiveVideoDuration(duration || 8, quality);
  const credits = estimateVideoCharge(duration || 8, quality, isRetake);
  let chargedAmount = 0;
  let wasFree = false;

  try {
    const charge = await chargeGeneration(auth.userId, 'video', credits, {
      projectId,
      shotId,
      metadata: {
        duration: effectiveDuration,
        mode,
        quality,
        isRetake,
        refs: Array.isArray(referenceImageUrls) ? referenceImageUrls.length : 0,
        voices: Array.isArray(referenceVoiceIds) ? referenceVoiceIds.length : 0,
        model: 'grok-imagine-video-1.5',
      },
      description: `Video ${quality}${isRetake ? ' retake' : ''} ${effectiveDuration}s 1.5 (${credits} credits)`,
    });
    chargedAmount = charge.creditsCharged;
    wasFree = charge.free;

    const result = await generateVideo({
      prompt,
      imageUrl,
      videoUrl,
      referenceImageUrls: Array.isArray(referenceImageUrls) ? referenceImageUrls : undefined,
      referenceVoiceIds: Array.isArray(referenceVoiceIds) ? referenceVoiceIds : undefined,
      duration: effectiveDuration,
      mode,
      resolution: resolution || '720p',
      aspectRatio: aspectRatio || '16:9',
    });

    const stored = await persistRemoteAsset(
      result.url,
      `clips/${projectId}/${shotId || Date.now()}.mp4`
    );

    const refreshed = await User.findById(auth.userId).select(
      'creditBalance firstCutFreeImagesRemaining firstCutFreeVideosRemaining firstCutStatus'
    );
    return NextResponse.json({
      videoUrl: stored.url,
      persisted: stored.persisted,
      duration: result.duration,
      model: result.model,
      creditsCharged: chargedAmount,
      freeSample: wasFree,
      quality,
      isRetake,
      effectiveDuration,
      creditBalance: refreshed?.creditBalance ?? null,
      firstCut: {
        freeImagesRemaining: refreshed?.firstCutFreeImagesRemaining,
        freeVideosRemaining: refreshed?.firstCutFreeVideosRemaining,
        status: refreshed?.firstCutStatus,
      },
    });
  } catch (err) {
    if (chargedAmount > 0) {
      await refundCredits(auth.userId, chargedAmount, {
        description: 'Refund: video generation failed',
        projectId,
        shotId,
      }).catch(() => {});
    }

    if (err instanceof FreeSampleExhaustedError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          nextStep: err.nextStep,
          upgradeHint: 'Start your 7-day free Creator trial to keep generating.',
        },
        { status: 402 }
      );
    }

    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          required: err.required,
          balance: err.balance,
          nextStep: err.nextStep,
          upgradeHint: 'Start free trial or upgrade in Billing.',
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Video generation failed' },
      { status: 500 }
    );
  }
}
