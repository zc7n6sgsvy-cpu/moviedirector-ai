import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import FeedItem from '@/models/FeedItem';
import { requireAuth } from '@/lib/auth';
import { serializeFeedItem } from '@/lib/serialize';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { projectId } = await request.json();
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await dbConnect();
  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  project.isPublic = true;
  await project.save();

  const feedItem = await FeedItem.findOneAndUpdate(
    { projectId },
    {
      projectId,
      creatorId: auth.userId,
      creatorUsername: auth.username,
      title: project.title,
      logline: project.logline,
      publishedAt: new Date(),
      $setOnInsert: { likeCount: 0 },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({
    success: true,
    feedItem: serializeFeedItem(feedItem.toObject()),
  });
}