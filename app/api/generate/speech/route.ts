import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { generateSpeech } from '@/lib/xai';
import {
  chargeCredits,
  refundCredits,
  InsufficientCreditsError,
} from '@/lib/billing';
import { getPlan, speechCredits } from '@/lib/plans';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan creditBalance');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `gen-speech:${auth.userId}:${clientIp(req)}`,
    Math.max(20, plan.genImagePerHour),
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
  const { text, voice, styleHint, projectId, shotId } = body as {
    text?: string;
    voice?: string;
    styleHint?: string;
    projectId?: string;
    shotId?: string;
  };

  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const credits = speechCredits();
  let chargedAmount = 0;

  try {
    await chargeCredits(auth.userId, credits, 'image_charge', {
      projectId,
      shotId,
      description: `TTS voice line (${credits} credits)`,
      metadata: { kind: 'speech', voice: voice || 'ara' },
    });
    chargedAmount = credits;

    const { buffer, contentType } = await generateSpeech({
      text: text.trim().slice(0, 4000),
      voice: voice || 'ara',
      styleHint,
    });

    let audioUrl: string;
    let persisted = false;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(
        `voice/${projectId}/${shotId || Date.now()}.mp3`,
        buffer,
        {
          access: 'public',
          contentType: contentType || 'audio/mpeg',
          addRandomSuffix: true,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      audioUrl = blob.url;
      persisted = true;
    } else {
      audioUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      audioUrl,
      persisted,
      creditsCharged: chargedAmount,
      creditBalance: refreshed?.creditBalance ?? null,
      voice: voice || 'ara',
    });
  } catch (err) {
    if (chargedAmount > 0) {
      await refundCredits(auth.userId, chargedAmount, {
        description: 'Refund: speech generation failed',
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
          nextStep: err.nextStep,
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Speech generation failed' },
      { status: 500 }
    );
  }
}
