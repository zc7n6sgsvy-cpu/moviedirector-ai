import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import GenerationJob from '@/models/GenerationJob';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { processGenerationJob } from '@/lib/generation-worker';
import { estimateProjectCost } from '@/lib/cost';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`gen-batch:${auth.userId}:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfterSec: limited.retryAfterSec }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured on server' }, { status: 503 });
  }

  const { projectId, shotIds, mode = 'batch-video', prompts } = await req.json();
  if (!projectId || !Array.isArray(shotIds) || shotIds.length === 0) {
    return NextResponse.json({ error: 'projectId and shotIds required' }, { status: 400 });
  }

  await dbConnect();
  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const shots = (project.shots || []) as Array<{ id: string; duration?: number; videoUrl?: string }>;
  const targetShots = shots.filter((s) => shotIds.includes(s.id));
  const cost = estimateProjectCost(targetShots);

  const job = await GenerationJob.create({
    userId: auth.userId,
    projectId,
    type: 'batch',
    mode,
    status: 'pending',
    items: targetShots.map((shot) => ({
      shotId: shot.id,
      status: 'pending',
      prompt: prompts?.[shot.id],
    })),
    progress: 0,
  });

  processGenerationJob(job._id.toString()).catch(async (err) => {
    await GenerationJob.findByIdAndUpdate(job._id, {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Batch failed',
    });
  });

  return NextResponse.json({
    jobId: job._id.toString(),
    status: job.status,
    progress: job.progress,
    costEstimate: cost,
  });
}