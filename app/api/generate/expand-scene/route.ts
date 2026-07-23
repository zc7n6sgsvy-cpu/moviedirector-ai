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
import { parseSceneExpandJson } from '@/lib/discover-from-frame';

export const maxDuration = 60;

const EXPAND_CREDITS = 1;

/**
 * POST /api/generate/expand-scene
 * Script + seed shots → AI proposes a new scene beat for an empty shot.
 * Does not generate pixels — only description/camera/dialogue (cheap).
 * User can then GENERATE FRAME with locked cast/set.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('plan');
  const plan = getPlan(user?.plan);

  const limited = await rateLimit(
    `expand:${auth.userId}:${clientIp(req)}`,
    Math.max(30, plan.genImagePerHour),
    60 * 60 * 1000
  );
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!process.env.XAI_API_KEY) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 503 });
  }

  const body = await req.json();
  const { projectId, seedShotIds, targetShotId, creative = true } = body as {
    projectId?: string;
    seedShotIds?: string[];
    targetShotId?: string;
    creative?: boolean;
  };

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const project = await Project.findById(projectId).lean();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const shots = (project.shots || []) as Array<{
    id?: string;
    number?: number;
    description?: string;
    dialogue?: string;
    camera?: string;
    characterIds?: string[];
    environmentId?: string;
  }>;
  const seeds = shots.filter((s) => (seedShotIds || []).includes(s.id || ''));
  const cast = (project.characters || []) as Array<{ id?: string; name?: string; role?: string; description?: string }>;
  const envs = (project.environments || []) as Array<{ id?: string; name?: string; description?: string }>;

  const seedBlock = seeds
    .map(
      (s) =>
        `Shot ${s.number}: ${s.description || ''} | dialogue: ${s.dialogue || '—'} | camera: ${s.camera || '—'}`
    )
    .join('\n');

  const castBlock = cast
    .map((c) => `${c.name} (${c.role}): ${(c.description || '').slice(0, 120)}`)
    .join('\n');

  const envBlock = envs.map((e) => `${e.name}: ${(e.description || '').slice(0, 100)}`).join('\n');

  const system = `You are a TV/film director expanding a series episode beat sheet for MovieDirector.
Return ONLY JSON (no markdown):
{
  "description": "visual action for one new key still / shot",
  "camera": "framing",
  "dialogue": "optional spoken line",
  "emotion": "performance",
  "suggestedCharacterNames": ["names from cast if used"],
  "environmentHint": "set name if using a locked set"
}
${creative ? 'Be inventive but stay in the same series world.' : 'Stay tightly continuous with prior shots.'}
Prefer reusing named cast and locked sets when listed. Original characters only — no celebrities.`;

  const userMsg = [
    `Series: "${project.title}"`,
    `Logline: ${project.logline || ''}`,
    `Type: ${project.type}`,
    project.script ? `Script excerpt:\n${String(project.script).slice(0, 2000)}` : '',
    project.concept ? `Concept: ${project.concept}` : '',
    castBlock ? `LOCKED CAST:\n${castBlock}` : 'No locked cast yet — you may invent new people for discovery later.',
    envBlock ? `LOCKED SETS:\n${envBlock}` : 'No locked sets yet.',
    seedBlock ? `SEED SHOTS:\n${seedBlock}` : 'No seed shots — invent next beat from script/logline.',
    targetShotId ? `Fill empty shot id ${targetShotId}.` : 'Propose the next scene beat.',
    'Write one shot that could be generated as a single frame then animated.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let charged = 0;
  try {
    await chargeCredits(auth.userId, EXPAND_CREDITS, 'image_charge', {
      projectId,
      shotId: targetShotId,
      description: `AI expand scene beat (${EXPAND_CREDITS} cr)`,
      metadata: { kind: 'expand-scene' },
    });
    charged = EXPAND_CREDITS;

    const text = await completeText(system, userMsg);
    const expanded = parseSceneExpandJson(text);

    const refreshed = await User.findById(auth.userId).select('creditBalance');
    return NextResponse.json({
      expanded,
      creditsCharged: charged,
      creditBalance: refreshed?.creditBalance ?? null,
    });
  } catch (err) {
    if (charged > 0) {
      await refundCredits(auth.userId, charged, {
        description: 'Refund: expand-scene failed',
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
      { error: err instanceof Error ? err.message : 'Expand failed' },
      { status: 500 }
    );
  }
}
