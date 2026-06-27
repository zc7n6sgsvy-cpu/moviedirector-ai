import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';

const ALLOWED_FIELDS = [
  'title', 'type', 'logline', 'concept', 'synopsis', 'style', 'berserker', 'shots', 'characters', 'isPublic',
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await dbConnect();
  const project = await Project.findOne({ _id: id, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json(serializeDoc(project.toObject()));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  updates.updatedAt = new Date();

  const project = await Project.findOneAndUpdate(
    { _id: id, userId: auth.userId },
    { $set: updates },
    { new: true }
  );

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json(serializeDoc(project.toObject()));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await dbConnect();
  const result = await Project.deleteOne({ _id: id, userId: auth.userId });
  if (!result.deletedCount) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}