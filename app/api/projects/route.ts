import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { assertCanCreateProject, ProjectLimitError } from '@/lib/billing';

const ALLOWED_CREATE_FIELDS = [
  'title',
  'type',
  'logline',
  'concept',
  'synopsis',
  'style',
  'berserker',
  'shots',
  'characters',
  'isFirstCut',
  'firstCutPath',
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const projects = await Project.find({ userId: auth.userId }).sort({ updatedAt: -1 });
    return NextResponse.json(projects.map((p) => serializeDoc(p.toObject())));
  } catch (err) {
    console.error('GET /api/projects', err);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const limited = await rateLimit(
      `project-create:${auth.userId}:${clientIp(request)}`,
      30,
      60 * 60 * 1000
    );
    if (!limited.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.title || !body.logline || !body.type) {
      return NextResponse.json(
        { error: 'title, type, and logline are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const currentCount = await Project.countDocuments({ userId: auth.userId });
    try {
      await assertCanCreateProject(auth.userId, currentCount);
    } catch (err) {
      if (err instanceof ProjectLimitError) {
        return NextResponse.json(
          {
            error: err.message,
            code: err.code,
            max: err.max,
            upgradeHint: 'Upgrade your plan in Billing to create more projects.',
          },
          { status: 403 }
        );
      }
      throw err;
    }

    const data: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(auth.userId),
    };
    for (const field of ALLOWED_CREATE_FIELDS) {
      if (field in body && body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const project = await Project.create(data);
    const plain = project.toObject();
    return NextResponse.json(serializeDoc(plain));
  } catch (err) {
    console.error('POST /api/projects', err);
    const message = err instanceof Error ? err.message : 'Create project failed';
    if (/JWT_SECRET/i.test(message)) {
      return NextResponse.json(
        { error: 'JWT_SECRET missing. Add it in Vercel and redeploy.', code: 'JWT_SECRET_MISSING' },
        { status: 503 }
      );
    }
    if (/MONGODB|mongo|ServerSelection|whitelist/i.test(message)) {
      return NextResponse.json(
        { error: 'Database unavailable. Check MONGODB_URI and Atlas Network Access.', code: 'DB_ERROR' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Could not save project. Try again.', detail: message, code: 'CREATE_FAILED' },
      { status: 500 }
    );
  }
}
