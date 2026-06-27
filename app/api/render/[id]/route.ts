import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RenderJob from '@/models/RenderJob';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await dbConnect();
  const job = await RenderJob.findOne({ _id: id, userId: auth.userId });
  if (!job) return NextResponse.json({ error: 'Render job not found' }, { status: 404 });

  return NextResponse.json({
    id: job._id.toString(),
    status: job.status,
    progress: job.progress,
    outputUrl: job.outputUrl,
    error: job.error,
    clipCount: job.clipUrls.length,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = process.env.RENDER_WORKER_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  const job = await RenderJob.findByIdAndUpdate(
    id,
    {
      $set: {
        status: body.status,
        progress: body.progress,
        outputUrl: body.outputUrl,
        error: body.error,
      },
    },
    { new: true }
  );

  if (!job) return NextResponse.json({ error: 'Render job not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}