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

  const body = await req.json();
  const { projectId, dropStillBridges, aiAssemble } = body as {
    projectId?: string;
    /** Drop transition stills that never got a bridge clip */
    dropStillBridges?: boolean;
    /** User clicked “Let AI render for you” */
    aiAssemble?: boolean;
  };
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await dbConnect();
  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  type ShotRow = {
    videoUrl?: string;
    imageUrl?: string;
    shotKind?: string;
    isTransition?: boolean;
    number?: number;
    description?: string;
    voiceAudioUrl?: string;
    voiceoverScript?: string;
    duration?: number;
  };

  let shots = (project.shots || []) as ShotRow[];
  if (dropStillBridges || aiAssemble) {
    shots = shots.filter((s) => {
      const isTr = s.shotKind === 'transition' || s.isTransition;
      if (!isTr) return true;
      return !!s.videoUrl; // keep only animated bridges
    });
  }

  const clipUrls = shots.map((s) => s.videoUrl).filter(Boolean) as string[];

  if (clipUrls.length < 1) {
    return NextResponse.json(
      {
        error: 'No video clips to render',
        hint: 'Generate story clips (and optional transition bridge clips) first, then let AI assemble.',
      },
      { status: 400 }
    );
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
      body: JSON.stringify({
        jobId: job._id.toString(),
        clipUrls,
        projectTitle: project.title,
        aiAssemble: !!aiAssemble,
        shots: shots.map((s) => ({
          number: s.number,
          description: s.description,
          duration: s.duration,
          videoUrl: s.videoUrl,
          voiceAudioUrl: s.voiceAudioUrl,
          voiceoverScript: s.voiceoverScript,
          isTransition: s.shotKind === 'transition' || s.isTransition,
        })),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    jobId: job._id.toString(),
    status: job.status,
    clipCount: clipUrls.length,
    workerQueued: !!workerUrl,
    aiAssemble: !!aiAssemble,
    droppedStillBridges: !!(dropStillBridges || aiAssemble),
  });
}