import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const ALLOWED_CREATE_FIELDS = [
  'title', 'type', 'logline', 'concept', 'synopsis', 'style', 'berserker', 'shots', 'characters',
] as const;

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const projects = await Project.find({ userId: auth.userId }).sort({ updatedAt: -1 });
  return NextResponse.json(projects.map((p) => serializeDoc(p.toObject())));
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`project-create:${auth.userId}:${clientIp(request)}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await request.json();
  await dbConnect();

  const data: Record<string, unknown> = { userId: auth.userId };
  for (const field of ALLOWED_CREATE_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  const project = await Project.create({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json(serializeDoc(project.toObject()));
}