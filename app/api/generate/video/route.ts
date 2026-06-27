import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { generateVideo } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`gen-video:${auth.userId}:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured on server' }, { status: 503 });
  }

  const body = await req.json();
  const { prompt, imageUrl, videoUrl, referenceImageUrls, duration, mode, projectId, shotId } = body;

  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  try {
    const result = await generateVideo({
      prompt,
      imageUrl,
      videoUrl,
      referenceImageUrls,
      duration,
      mode,
    });

    const stored = await persistRemoteAsset(
      result.url,
      `clips/${projectId || 'single'}/${shotId || Date.now()}.mp4`
    );

    return NextResponse.json({
      videoUrl: stored.url,
      persisted: stored.persisted,
      duration: result.duration,
      model: result.model,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Video generation failed' },
      { status: 500 }
    );
  }
}