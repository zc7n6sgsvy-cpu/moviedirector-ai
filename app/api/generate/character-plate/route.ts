import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { editImage } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';
import {
  chargeGeneration,
  refundCredits,
  estimateImageCharge,
  type GenQuality,
  InsufficientCreditsError,
  FreeSampleExhaustedError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import { buildSoloPlateExtractPrompt } from '@/lib/character-capture';

export const maxDuration = 120;

/**
 * POST /api/generate/character-plate
 * Extract a SOLO reusable character plate from a multi-person source still.
 * This is the durable reference used when reinserting cast on later shots.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan creditBalance');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `char-plate:${auth.userId}:${clientIp(req)}`,
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
  const {
    projectId,
    sourceImageUrl,
    characterId,
    name,
    role,
    faceNotes,
    wardrobe,
    subjectHint,
    description,
    visibility,
    aspectRatio,
  } = body as {
    projectId?: string;
    sourceImageUrl?: string;
    characterId?: string;
    name?: string;
    role?: string;
    faceNotes?: string;
    wardrobe?: string;
    subjectHint?: string;
    description?: string;
    visibility?: string;
    aspectRatio?: string;
  };

  if (!projectId || !sourceImageUrl || !name) {
    return NextResponse.json(
      { error: 'projectId, sourceImageUrl, and name required' },
      { status: 400 }
    );
  }
  if (!/^https?:\/\//i.test(sourceImageUrl)) {
    return NextResponse.json({ error: 'sourceImageUrl must be a public https URL' }, { status: 400 });
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  // Draft-class cost — capture is intentional production spend
  const quality: GenQuality = 'draft';
  const credits = estimateImageCharge(quality, false);
  let chargedAmount = 0;

  const prompt = buildSoloPlateExtractPrompt({
    name,
    role,
    faceNotes,
    wardrobe,
    subjectHint,
    description,
    visibility,
  });

  try {
    const charge = await chargeGeneration(auth.userId, 'image', credits, {
      projectId,
      shotId: characterId ? `char-plate-${characterId}` : `char-plate-${Date.now()}`,
      metadata: { kind: 'character-plate', name, quality },
      description: `Solo character plate: ${name} (${credits} cr)`,
    });
    chargedAmount = charge.creditsCharged;

    const edited = await editImage(prompt, [sourceImageUrl], {
      aspectRatio: aspectRatio || '3:4',
      strategy: 'continuity',
    });

    const stored = await persistRemoteAsset(
      edited.url,
      `characters/${projectId}/${(name || 'char').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`
    );

    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      imageUrl: stored.url,
      persisted: stored.persisted,
      creditsCharged: chargedAmount,
      freeSample: charge.free,
      editMode: edited.mode,
      creditBalance: refreshed?.creditBalance ?? null,
      characterId: characterId || null,
      name,
      promptUsed: prompt,
    });
  } catch (err) {
    if (chargedAmount > 0) {
      await refundCredits(auth.userId, chargedAmount, {
        description: 'Refund: character plate failed',
        projectId,
      }).catch(() => {});
    }
    if (err instanceof FreeSampleExhaustedError) {
      return NextResponse.json(
        { error: err.message, code: err.code, nextStep: err.nextStep },
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
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Character plate failed' },
      { status: 500 }
    );
  }
}
