import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import FeedItem from '@/models/FeedItem';
import { requireAuth } from '@/lib/auth';
import { serializeFeedItem } from '@/lib/serialize';
import User from '@/models/User';
import { sendPublishNotification } from '@/lib/sendgrid';

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

  // Attach a preview clip/image from the project if available
  const firstVideo = (project.shots || []).find((s: any) => s.videoUrl)?.videoUrl;
  const firstImage = (project.shots || []).find((s: any) => s.imageUrl)?.imageUrl;
  const preview = firstVideo || firstImage || undefined;

  const feedItem = await FeedItem.findOneAndUpdate(
    { projectId },
    {
      projectId,
      creatorId: auth.userId,
      creatorUsername: auth.username,
      title: project.title,
      logline: project.logline,
      publishedAt: new Date(),
      previewClip: preview,
      $setOnInsert: { likeCount: 0 },
    },
    { upsert: true, new: true }
  );

  // Notify creator via email (best effort)
  try {
    const user = await User.findById(auth.userId);
    if (user?.email) {
      const filmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moviedirector-psi.vercel.app'}/?film=${feedItem._id}`;
      sendPublishNotification(user.email, user.username, project.title, filmUrl).catch(() => {});
    }
  } catch {}

  return NextResponse.json({
    success: true,
    feedItem: serializeFeedItem(feedItem.toObject()),
  });
}