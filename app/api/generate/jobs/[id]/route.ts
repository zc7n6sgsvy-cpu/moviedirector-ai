import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GenerationJob from '@/models/GenerationJob';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await dbConnect();
  const job = await GenerationJob.findOne({ _id: id, userId: auth.userId });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  return NextResponse.json({
    id: job._id.toString(),
    status: job.status,
    progress: job.progress,
    mode: job.mode,
    items: job.items,
    error: job.error,
    updatedAt: job.updatedAt,
  });
}