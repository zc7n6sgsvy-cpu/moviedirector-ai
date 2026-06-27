import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';
import Project from '@/models/Project';
import Comment from '@/models/Comment';
import { serializeFeedItem } from '@/lib/serialize';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const item = await FeedItem.findById(id);
  if (!item) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const project = await Project.findById(item.projectId).select('title type shots characters');
  const recentComments = await Comment.find({ feedItemId: id, parentId: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(5);

  return NextResponse.json({
    ...serializeFeedItem(item.toObject()),
    project: project ? {
      id: project._id.toString(),
      type: project.type,
      shotCount: project.shots?.length ?? 0,
      clipCount: (project.shots || []).filter((s: { videoUrl?: string }) => s.videoUrl).length,
      previewClip: (project.shots || []).find((s: { videoUrl?: string }) => s.videoUrl)?.videoUrl,
    } : null,
    recentComments: recentComments.map((c) => ({
      id: c._id.toString(),
      username: c.username,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}