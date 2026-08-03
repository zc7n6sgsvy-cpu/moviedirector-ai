import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyProjectAccess } from '@/lib/project-auth';
import { completeText } from '@/lib/xai';
import {
  chargeCredits,
  refundCredits,
  InsufficientCreditsError,
} from '@/lib/billing';
import { getPlan } from '@/lib/plans';
import {
  buildNarrativeSystemPrompt,
  buildNarrativeUserPrompt,
  parseNarrativeResult,
  resolveGenre,
  type EmotionalTarget,
  type NarrativeGenre,
  type NarrativeMode,
} from '@/lib/narrative-engine';
import type { Project as ProjectT } from '@/lib/types';

export const maxDuration = 120;

/** Text-only elevation — cheaper than pixels */
const NARRATIVE_CREDITS = 2;

/**
 * POST /api/generate/narrative
 * Narrative Engine — showrunner proposals (2–3 versions). No pixels.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `narrative:${auth.userId}:${clientIp(req)}`,
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
    mode = 'amplify',
    genre = 'auto',
    targets = [],
    selectedShotNumbers,
    scriptExcerpt,
  } = body as {
    projectId?: string;
    mode?: NarrativeMode;
    genre?: NarrativeGenre;
    targets?: EmotionalTarget[];
    selectedShotNumbers?: number[];
    scriptExcerpt?: string;
  };

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const doc = await Project.findById(projectId).lean();
  if (!doc) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const project = {
    id: (doc as { _id: { toString: () => string } })._id.toString(),
    title: (doc as { title: string }).title,
    type: (doc as { type: string }).type,
    logline: (doc as { logline: string }).logline,
    concept: (doc as { concept?: string }).concept,
    synopsis: (doc as { synopsis?: string }).synopsis,
    script: (doc as { script?: string }).script,
    worldBible: (doc as { worldBible?: ProjectT['worldBible'] }).worldBible,
    style: (doc as { style?: ProjectT['style'] }).style,
    shots: (doc as { shots?: ProjectT['shots'] }).shots || [],
    characters: (doc as { characters?: ProjectT['characters'] }).characters || [],
    berserker: !!(doc as { berserker?: boolean }).berserker,
    createdAt: '',
    updatedAt: '',
  } as ProjectT;

  const genreResolved = resolveGenre(genre || 'auto', project);
  const modeResolved = (mode || 'amplify') as NarrativeMode;
  const targetsResolved = (Array.isArray(targets) ? targets : []) as EmotionalTarget[];

  if (modeResolved === 'selected-range' && !(selectedShotNumbers || []).length && !scriptExcerpt) {
    return NextResponse.json(
      { error: 'Selected range mode needs selectedShotNumbers or scriptExcerpt' },
      { status: 400 }
    );
  }

  const system = buildNarrativeSystemPrompt(genreResolved, modeResolved);
  const userMsg = buildNarrativeUserPrompt({
    project,
    mode: modeResolved,
    genre: genreResolved,
    targets: targetsResolved,
    selectedShotNumbers,
    scriptExcerpt,
  });

  let charged = 0;
  try {
    await chargeCredits(auth.userId, NARRATIVE_CREDITS, 'image_charge', {
      projectId,
      description: `Narrative Engine (${modeResolved}, ${NARRATIVE_CREDITS} cr)`,
      metadata: { kind: 'narrative-engine', mode: modeResolved, genre: genreResolved },
    });
    charged = NARRATIVE_CREDITS;

    const text = await completeText(system, userMsg);
    const result = parseNarrativeResult(text, {
      mode: modeResolved,
      genre: genreResolved,
      targets: targetsResolved,
    });

    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      result,
      creditsCharged: charged,
      creditBalance: refreshed?.creditBalance ?? null,
    });
  } catch (err) {
    if (charged > 0) {
      await refundCredits(auth.userId, charged, {
        description: 'Refund: narrative engine failed',
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
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Narrative engine failed' },
      { status: 500 }
    );
  }
}
