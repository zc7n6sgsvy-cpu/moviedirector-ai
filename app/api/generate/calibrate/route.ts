import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { verifyProjectAccess } from '@/lib/project-auth';
import { scanSequenceStructural } from '@/lib/calibration-engine';
import type { Project as ProjectT } from '@/lib/types';

export const maxDuration = 60;

/**
 * POST /api/generate/calibrate
 * Structural sequence scan (free). Returns flags for the timeline.
 * Vision pass can be layered later as a paid step.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { projectId } = body as { projectId?: string };
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  await dbConnect();
  const access = await verifyProjectAccess(auth.userId, projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const doc = await Project.findById(projectId).lean();
  if (!doc) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const project = {
    id: (doc as { _id: { toString: () => string } })._id.toString(),
    title: (doc as { title: string }).title,
    type: (doc as { type: string }).type,
    logline: (doc as { logline: string }).logline,
    shots: (doc as { shots?: ProjectT['shots'] }).shots || [],
    characters: (doc as { characters?: ProjectT['characters'] }).characters || [],
    environments: (doc as { environments?: ProjectT['environments'] }).environments || [],
    defaultEnvironmentId: (doc as { defaultEnvironmentId?: string }).defaultEnvironmentId,
    berserker: !!(doc as { berserker?: boolean }).berserker,
    createdAt: '',
    updatedAt: '',
  } as ProjectT;

  const report = scanSequenceStructural(project);

  // Persist summary on project for reload
  await Project.findByIdAndUpdate(projectId, {
    $set: {
      calibrationReport: {
        scannedAt: report.scannedAt,
        issueCount: report.issueCount,
        summary: report.summary,
        issues: report.issues,
      },
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    report,
    creditsCharged: 0,
    free: true,
  });
}
