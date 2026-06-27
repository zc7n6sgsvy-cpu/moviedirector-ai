import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { generateImage } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`gen-image:${auth.userId}:${clientIp(req)}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured on server' }, { status: 503 });
  }

  const { prompt, aspectRatio, projectId, shotId } = await req.json();
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  try {
    const result = await generateImage(prompt, aspectRatio);
    const stored = await persistRemoteAsset(
      result.url,
      `frames/${projectId || 'single'}/${shotId || Date.now()}.jpg`
    );
    return NextResponse.json({ imageUrl: stored.url, persisted: stored.persisted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}