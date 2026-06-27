import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import RenderJob from '@/models/RenderJob';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`render:${auth.userId}:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec }, { status: 429 });
  }

  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await dbConnect();
  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const clipUrls = ((project.shots || []) as Array<{ videoUrl?: string }>)
    .map((s) => s.videoUrl)
    .filter(Boolean) as string[];

  if (clipUrls.length < 1) {
    return NextResponse.json({ error: 'No video clips to render' }, { status: 400 });
  }

  const job = await RenderJob.create({
    userId: auth.userId,
    projectId,
    clipUrls,
    status: 'pending',
    progress: 0,
  });

  const workerUrl = process.env.RENDER_WORKER_URL;
  if (workerUrl) {
    fetch(`${workerUrl.replace(/\/$/, '')}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RENDER_WORKER_SECRET || ''}`,
      },
      body: JSON.stringify({ jobId: job._id.toString(), clipUrls, projectTitle: project.title }),
    }).catch(() => {});
  }

  return NextResponse.json({
    jobId: job._id.toString(),
    status: job.status,
    clipCount: clipUrls.length,
    workerQueued: !!workerUrl,
  });
}