import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { generateImage } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`gen-image:${auth.userId}:${clientIp(req)}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured on server' }, { status: 503 });
  }

  const { prompt, aspectRatio, projectId, shotId } = await req.json();
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await dbConnect();
  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const result = await generateImage(prompt, aspectRatio);
    const stored = await persistRemoteAsset(
      result.url,
      `frames/${projectId}/${shotId || Date.now()}.jpg`
    );
    return NextResponse.json({ imageUrl: stored.url, persisted: stored.persisted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}