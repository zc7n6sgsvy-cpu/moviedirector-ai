import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { generateImage, editImage } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';
import {
  chargeGeneration,
  refundCredits,
  estimateImageCharge,
  isShotRetake,
  type GenQuality,
  InsufficientCreditsError,
  FreeSampleExhaustedError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import Project from '@/models/Project';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan creditBalance');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `gen-image:${auth.userId}:${clientIp(req)}`,
    plan.genImagePerHour,
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
  const { prompt, aspectRatio, projectId, shotId } = body;
  const quality: GenQuality = body.quality === 'draft' ? 'draft' : 'final';
  /** Public image URLs for edit / multi-image continuity (bridge frames) */
  const referenceImageUrls: string[] = Array.isArray(body.referenceImageUrls)
    ? body.referenceImageUrls
        .filter((u: unknown) => typeof u === 'string' && /^https?:\/\//i.test(u as string))
        .slice(0, 3)
    : [];
  const modeHint = String(body.mode || 'generate');
  /** Continuity / bridge: never cold text invent when plates exist */
  const forceEdit =
    modeHint === 'edit' ||
    modeHint === 'bridge' ||
    modeHint === 'continuity' ||
    referenceImageUrls.length > 0;
  const editStrategy =
    modeHint === 'continuity' || modeHint === 'edit'
      ? 'continuity'
      : modeHint === 'bridge'
        ? 'multi'
        : referenceImageUrls.length
          ? 'continuity'
          : 'auto';

  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  if (forceEdit && !referenceImageUrls.length) {
    return NextResponse.json(
      {
        error:
          'Continuity lock requires a set/cast plate or prior frame. Discover & lock, or generate one seed frame first.',
        code: 'CONTINUITY_PLATE_REQUIRED',
      },
      { status: 400 }
    );
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const projectDoc = await Project.findById(projectId).select('shots').lean();
  const isRetake = isShotRetake(projectDoc as { shots?: Array<{ id?: string; imageUrl?: string }> }, shotId, 'image');
  const credits = estimateImageCharge(quality, isRetake);
  let chargedAmount = 0;
  let wasFree = false;

  try {
    const charge = await chargeGeneration(auth.userId, 'image', credits, {
      projectId,
      shotId,
      metadata: {
        quality,
        isRetake,
        mode: forceEdit ? modeHint || 'edit' : 'generate',
        refs: referenceImageUrls.length,
        editStrategy,
      },
      description: `Image ${quality}${forceEdit ? ` ${modeHint || 'edit'}` : ''}${isRetake ? ' retake' : ''} (${credits} credits)`,
    });
    chargedAmount = charge.creditsCharged;
    wasFree = charge.free;

    let result: { url: string };
    let usedEdit = false;
    let editMode: string | undefined;
    if (forceEdit && referenceImageUrls.length) {
      // Hard-fail if edit fails — NEVER invent a new scene via text-only
      const edited = await editImage(prompt, referenceImageUrls, {
        aspectRatio: aspectRatio || '16:9',
        strategy: editStrategy as 'continuity' | 'multi' | 'auto',
      });
      result = { url: edited.url };
      usedEdit = true;
      editMode = edited.mode;
    } else {
      result = await generateImage(prompt, aspectRatio);
    }

    const stored = await persistRemoteAsset(
      result.url,
      `frames/${projectId}/${shotId || Date.now()}.jpg`
    );

    const refreshed = await User.findById(auth.userId).select(
      'creditBalance firstCutFreeImagesRemaining firstCutFreeVideosRemaining firstCutStatus'
    );
    return NextResponse.json({
      imageUrl: stored.url,
      persisted: stored.persisted,
      creditsCharged: chargedAmount,
      freeSample: wasFree,
      quality,
      isRetake,
      usedEdit,
      editMode,
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
        description: 'Refund: image generation failed',
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
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
