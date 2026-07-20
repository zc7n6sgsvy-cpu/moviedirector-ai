import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { serializeDoc } from '@/lib/serialize';
import {
  FIRST_CUT_FREE_IMAGES,
  FIRST_CUT_FREE_VIDEOS,
  FIRST_CUT_PATHS,
  buildFirstCutProject,
  getFirstCutPath,
  type FirstCutPathId,
} from '@/lib/first-cut';

function generateShotId() {
  return Math.random().toString(36).slice(2, 11);
}

/** GET — catalog of First Cut paths + user funnel state */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  // Catalog is public; user state only if authed
  const paths = FIRST_CUT_PATHS.map((p) => ({
    id: p.id,
    label: p.label,
    eyebrow: p.eyebrow,
    promise: p.promise,
    projectType: p.projectType,
    sampleOutcome: p.sampleOutcome,
    prompts: p.prompts,
  }));

  if ('error' in auth) {
    return NextResponse.json({
      paths,
      freeBudget: { images: FIRST_CUT_FREE_IMAGES, videos: FIRST_CUT_FREE_VIDEOS },
      user: null,
    });
  }

  await dbConnect();
  const user = await User.findById(auth.userId).select(
    'firstCutStatus firstCutProjectId firstCutPath firstCutFreeImagesRemaining firstCutFreeVideosRemaining firstCutCompletedAt plan planStatus trialEndsAt hasUsedTrial'
  );

  return NextResponse.json({
    paths,
    freeBudget: { images: FIRST_CUT_FREE_IMAGES, videos: FIRST_CUT_FREE_VIDEOS },
    user: user
      ? {
          firstCutStatus: user.firstCutStatus || 'not_started',
          firstCutProjectId: user.firstCutProjectId?.toString() || null,
          firstCutPath: user.firstCutPath || null,
          freeImagesRemaining: user.firstCutFreeImagesRemaining ?? FIRST_CUT_FREE_IMAGES,
          freeVideosRemaining: user.firstCutFreeVideosRemaining ?? FIRST_CUT_FREE_VIDEOS,
          firstCutCompletedAt: user.firstCutCompletedAt || null,
          plan: user.plan,
          planStatus: user.planStatus,
          hasUsedTrial: !!user.hasUsedTrial,
          trialEndsAt: user.trialEndsAt || null,
        }
      : null,
  });
}

/** POST — create First Cut project from walkthrough answers */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`first-cut:${auth.userId}:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json();
  const pathId = body.pathId as FirstCutPathId;
  const answers = (body.answers || {}) as Record<string, string>;

  if (!getFirstCutPath(pathId)) {
    return NextResponse.json({ error: 'Invalid pathId' }, { status: 400 });
  }

  const path = getFirstCutPath(pathId)!;
  for (const p of path.prompts) {
    if (p.required && !String(answers[p.key] || '').trim()) {
      return NextResponse.json({ error: `Missing required field: ${p.label}` }, { status: 400 });
    }
  }

  await dbConnect();
  const user = await User.findById(auth.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // One First Cut project per user — resume if already in progress
  if (user.firstCutProjectId && user.firstCutStatus === 'in_progress') {
    const existing = await Project.findOne({
      _id: user.firstCutProjectId,
      userId: auth.userId,
    });
    if (existing) {
      return NextResponse.json({
        project: serializeDoc(existing.toObject()),
        resumed: true,
        freeImagesRemaining: user.firstCutFreeImagesRemaining ?? FIRST_CUT_FREE_IMAGES,
        freeVideosRemaining: user.firstCutFreeVideosRemaining ?? FIRST_CUT_FREE_VIDEOS,
      });
    }
  }

  if (user.firstCutStatus === 'completed' && user.firstCutProjectId) {
    const existing = await Project.findOne({
      _id: user.firstCutProjectId,
      userId: auth.userId,
    });
    if (existing) {
      return NextResponse.json({
        project: serializeDoc(existing.toObject()),
        alreadyCompleted: true,
        freeImagesRemaining: user.firstCutFreeImagesRemaining ?? 0,
        freeVideosRemaining: user.firstCutFreeVideosRemaining ?? 0,
        message: 'First Cut already completed. Start a free trial to keep generating full projects.',
      });
    }
  }

  const built = buildFirstCutProject(pathId, answers);
  const shots = built.shots.map((s, idx) => ({
    ...s,
    id: generateShotId(),
    number: idx + 1,
  }));

  try {
    const project = await Project.create({
      userId: auth.userId,
      title: built.title,
      type: built.type,
      logline: built.logline,
      concept: built.concept,
      synopsis: built.synopsis,
      style: built.style,
      berserker: built.berserker,
      shots,
      characters: [],
      isFirstCut: true,
      firstCutPath: pathId,
    });

    user.firstCutStatus = 'in_progress';
    user.firstCutProjectId = project._id;
    user.firstCutPath = pathId;
    user.firstCutFreeImagesRemaining = FIRST_CUT_FREE_IMAGES;
    user.firstCutFreeVideosRemaining = FIRST_CUT_FREE_VIDEOS;
    user.onboardingStep = 'first_cut_generate';
    await user.save();

    return NextResponse.json({
      project: serializeDoc(project.toObject()),
      resumed: false,
      freeImagesRemaining: FIRST_CUT_FREE_IMAGES,
      freeVideosRemaining: FIRST_CUT_FREE_VIDEOS,
      guide: {
        next: 'Open Clips tab → Generate frame on shot 1 → Generate video. Use your free sample budget.',
        freeImages: FIRST_CUT_FREE_IMAGES,
        freeVideos: FIRST_CUT_FREE_VIDEOS,
        sampleOutcome: path.sampleOutcome,
      },
    });
  } catch (err) {
    console.error('First Cut create project failed', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Could not create First Cut project',
        code: 'FIRST_CUT_CREATE_FAILED',
      },
      { status: 500 }
    );
  }
}

/** PATCH — mark First Cut complete (sample ready → trial CTA) */
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'skip') {
    user.firstCutStatus = 'skipped';
    user.onboardingStep = 'trial_offer';
    await user.save();
    return NextResponse.json({ firstCutStatus: 'skipped', next: 'start_trial' });
  }

  // complete
  if (user.firstCutStatus === 'completed') {
    return NextResponse.json({
      firstCutStatus: 'completed',
      next: user.hasUsedTrial ? 'upgrade' : 'start_trial',
    });
  }

  // Require at least one generated media asset on the first-cut project
  if (user.firstCutProjectId) {
    const project = await Project.findById(user.firstCutProjectId);
    const shots = (project?.shots || []) as Array<{ imageUrl?: string; videoUrl?: string }>;
    const hasMedia = shots.some((s) => s.imageUrl || s.videoUrl);
    if (!hasMedia && action !== 'force_complete') {
      return NextResponse.json(
        {
          error: 'Generate at least one free frame or clip before completing First Cut.',
          code: 'SAMPLE_INCOMPLETE',
        },
        { status: 400 }
      );
    }
  }

  user.firstCutStatus = 'completed';
  user.firstCutCompletedAt = new Date();
  user.onboardingStep = 'trial_offer';
  await user.save();

  return NextResponse.json({
    firstCutStatus: 'completed',
    next: 'start_trial',
    message:
      'First Cut complete. Start your 7-day free Creator trial to unlock full generation and monthly credits.',
  });
}
