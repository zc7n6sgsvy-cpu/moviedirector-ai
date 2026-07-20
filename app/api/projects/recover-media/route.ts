import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import GenerationJob from '@/models/GenerationJob';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';
import {
  type RecoveredAsset,
  dedupeAssets,
  assetsToShots,
  extractAssetsFromProjects,
  isHttpMediaUrl,
} from '@/lib/media-recovery';

/**
 * POST /api/projects/recover-media
 *
 * Rebuild a separate cloud project from every media URL we can still find:
 * - client localStorage assets (body.localAssets)
 * - all of the user's Mongo projects
 * - generation job outputs
 * - Vercel Blob paths under frames/ and clips/
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();

  let body: {
    localAssets?: Array<{
      imageUrl?: string;
      videoUrl?: string;
      projectId?: string;
      projectTitle?: string;
      shotId?: string;
      shotNumber?: number;
      description?: string;
    }>;
    title?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const collected: RecoveredAsset[] = [];

  // 1) Client-reported local assets (last line of defense after hard refresh)
  for (const a of body.localAssets || []) {
    if (!isHttpMediaUrl(a.imageUrl) && !isHttpMediaUrl(a.videoUrl)) continue;
    collected.push({
      imageUrl: isHttpMediaUrl(a.imageUrl) ? a.imageUrl : undefined,
      videoUrl: isHttpMediaUrl(a.videoUrl) ? a.videoUrl : undefined,
      projectId: a.projectId,
      projectTitle: a.projectTitle,
      shotId: a.shotId,
      shotNumber: a.shotNumber,
      description: a.description,
      source: 'local',
    });
  }

  // 2) All projects owned by user
  const projects = await Project.find({ userId: auth.userId }).lean();
  for (const p of projects) {
    const shots = (p.shots || []) as Array<{
      id?: string;
      number?: number;
      description?: string;
      imageUrl?: string;
      videoUrl?: string;
    }>;
    for (const s of shots) {
      if (!isHttpMediaUrl(s.imageUrl) && !isHttpMediaUrl(s.videoUrl)) continue;
      collected.push({
        imageUrl: isHttpMediaUrl(s.imageUrl) ? s.imageUrl : undefined,
        videoUrl: isHttpMediaUrl(s.videoUrl) ? s.videoUrl : undefined,
        projectId: String(p._id),
        projectTitle: p.title as string,
        shotId: s.id,
        shotNumber: s.number,
        description: s.description,
        source: 'project',
      });
    }
  }

  // 3) Generation jobs
  const jobs = await GenerationJob.find({ userId: auth.userId }).sort({ createdAt: -1 }).limit(100).lean();
  for (const j of jobs) {
    for (const item of j.items || []) {
      if (!isHttpMediaUrl(item.imageUrl) && !isHttpMediaUrl(item.videoUrl)) continue;
      collected.push({
        imageUrl: isHttpMediaUrl(item.imageUrl) ? item.imageUrl : undefined,
        videoUrl: isHttpMediaUrl(item.videoUrl) ? item.videoUrl : undefined,
        projectId: j.projectId ? String(j.projectId) : undefined,
        shotId: item.shotId,
        description: item.prompt?.slice(0, 160),
        source: 'job',
      });
    }
  }

  // 4) Blob store scan — only paths under this user's project IDs (+ job project IDs)
  const ownedProjectIds = new Set([
    ...projects.map((p) => String(p._id)),
    ...jobs.map((j) => (j.projectId ? String(j.projectId) : '')).filter(Boolean),
  ]);
  const blobAssets: RecoveredAsset[] = [];
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      for (const prefix of ['frames/', 'clips/']) {
        let cursor: string | undefined;
        do {
          const page = await list({
            prefix,
            cursor,
            limit: 200,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          for (const b of page.blobs) {
            const url = b.url;
            const pathname = b.pathname || '';
            const isVideo = /\.mp4($|\?)/i.test(pathname) || pathname.startsWith('clips/');
            const isImage =
              (!isVideo && /\.(jpg|jpeg|png|webp)($|\?)/i.test(pathname)) ||
              (!isVideo && pathname.startsWith('frames/'));
            // paths: frames/{projectId}/{shotId}.jpg  or clips/{projectId}/...
            const parts = pathname.split('/');
            const maybeProjectId = parts[1];
            const owned =
              !!maybeProjectId &&
              (ownedProjectIds.has(maybeProjectId) ||
                // if only one user in early product, still require project id in path
                false);
            if (!owned) {
              // No project id in path — skip (avoid leaking other directors' blobs)
              continue;
            }
            blobAssets.push({
              imageUrl: isImage ? url : undefined,
              videoUrl: isVideo ? url : undefined,
              projectId: maybeProjectId,
              description: `Blob ${pathname}`,
              source: 'blob',
            });
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
      }
    } catch (err) {
      console.error('blob list failed', err);
    }
  }
  collected.push(...blobAssets);

  const unique = dedupeAssets(collected);

  if (!unique.length) {
    return NextResponse.json({
      recovered: 0,
      project: null,
      message:
        'No recoverable media found in your projects, generation jobs, blob store, or local assets. If clips were only temporary xAI URLs and never saved to Blob, they may have expired.',
      sources: { local: 0, project: 0, job: 0, blob: 0 },
    });
  }

  const sources = {
    local: unique.filter((a) => a.source === 'local').length,
    project: unique.filter((a) => a.source === 'project').length,
    job: unique.filter((a) => a.source === 'job').length,
    blob: unique.filter((a) => a.source === 'blob').length,
  };

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const title = body.title?.trim() || `Recovered Clips — ${stamp}`;

  const rawShots = assetsToShots(unique);
  const shots = rawShots.map((s, i) => ({
    ...s,
    id: new mongoose.Types.ObjectId().toString(),
    number: i + 1,
  }));

  const project = await Project.create({
    userId: auth.userId,
    title,
    type: 'film',
    logline: 'Auto-recovered frames and clips after a hard refresh / save race. Safe vault — edit or move assets as needed.',
    concept:
      'This project was created by MovieDirector media recovery. It gathers every still and clip we could still find so nothing stays lost.',
    synopsis: `Recovered ${unique.length} media item(s).\nSources: local ${sources.local}, projects ${sources.project}, jobs ${sources.job}, blob ${sources.blob}.`,
    berserker: false,
    shots,
    characters: [],
    script: '',
    worldBible: {},
    continuity: {},
  });

  return NextResponse.json({
    recovered: unique.length,
    sources,
    project: serializeDoc(project.toObject()),
    message: `Recovered ${unique.length} asset(s) into “${title}”.`,
  });
}

/** GET — dry-run counts without creating a project */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const projects = await Project.find({ userId: auth.userId }).lean();
  const fromProjects = extractAssetsFromProjects(
    projects.map((p) => ({
      id: String(p._id),
      title: p.title as string,
      type: (p.type as 'film') || 'film',
      logline: (p.logline as string) || '',
      berserker: !!p.berserker,
      shots: (p.shots || []) as never[],
      createdAt: '',
      updatedAt: '',
    })),
    'project'
  );

  const jobs = await GenerationJob.find({ userId: auth.userId }).limit(100).lean();
  let fromJobs = 0;
  for (const j of jobs) {
    for (const item of j.items || []) {
      if (isHttpMediaUrl(item.imageUrl) || isHttpMediaUrl(item.videoUrl)) fromJobs++;
    }
  }

  let fromBlob = 0;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      for (const prefix of ['frames/', 'clips/']) {
        const page = await list({ prefix, limit: 200, token: process.env.BLOB_READ_WRITE_TOKEN });
        fromBlob += page.blobs.length;
      }
    } catch {}
  }

  return NextResponse.json({
    projectMedia: fromProjects.length,
    jobMedia: fromJobs,
    blobApprox: fromBlob,
  });
}
