import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import GenerationJob from '@/models/GenerationJob';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { processGenerationJob } from '@/lib/generation-worker';
import { estimateProjectCost } from '@/lib/cost';
import {
  chargeCredits,
  refundCredits,
  estimateBatchVideoCharge,
  InsufficientCreditsError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `gen-batch:${auth.userId}:${clientIp(req)}`,
    plan.genBatchPerHour,
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

  const { projectId, shotIds, mode = 'batch-video', prompts } = await req.json();
  if (!projectId || !Array.isArray(shotIds) || shotIds.length === 0) {
    return NextResponse.json({ error: 'projectId and shotIds required' }, { status: 400 });
  }

  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const shots = (project.shots || []) as Array<{ id: string; duration?: number; videoUrl?: string }>;
  const targetShots = shots.filter((s) => shotIds.includes(s.id));
  const cost = estimateProjectCost(targetShots);
  const creditsRequired = estimateBatchVideoCharge(targetShots);

  let reserved = false;
  try {
    await chargeCredits(auth.userId, creditsRequired, 'batch_reserve', {
      description: `Batch reserve ${targetShots.length} clips (${creditsRequired} credits)`,
      projectId,
      metadata: { shotIds, mode },
    });
    reserved = true;

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
        creditsReserved: estimateBatchVideoCharge([shot]),
      })),
      progress: 0,
      creditsReserved: creditsRequired,
    });

    processGenerationJob(job._id.toString()).catch(async (err) => {
      await GenerationJob.findByIdAndUpdate(job._id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Batch failed',
      });
      // Full refund if worker dies before processing
      await refundCredits(auth.userId, creditsRequired, {
        description: 'Refund: batch job failed to start',
        projectId,
        jobId: job._id.toString(),
      }).catch(() => {});
    });

    const refreshed = await User.findById(auth.userId).select('creditBalance');

    return NextResponse.json({
      jobId: job._id.toString(),
      status: job.status,
      progress: job.progress,
      costEstimate: cost,
      creditsReserved: creditsRequired,
      creditBalance: refreshed?.creditBalance ?? null,
    });
  } catch (err) {
    if (reserved) {
      // Should not normally happen after charge before job create; refund if job create failed
      await refundCredits(auth.userId, creditsRequired, {
        description: 'Refund: batch setup failed',
        projectId,
      }).catch(() => {});
    }

    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          required: err.required,
          balance: err.balance,
          upgradeHint: 'Buy credits or upgrade your plan in Billing.',
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Batch queue failed' },
      { status: 500 }
    );
  }
}
