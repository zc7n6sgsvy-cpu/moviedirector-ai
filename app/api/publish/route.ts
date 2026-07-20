import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import FeedItem from '@/models/FeedItem';
import { requireAuth } from '@/lib/auth';
import { serializeFeedItem } from '@/lib/serialize';
import { isValidObjectId } from '@/lib/ids';
import User from '@/models/User';
import { sendPublishNotification } from '@/lib/sendgrid';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { projectId?: string; shots?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { projectId, shots: clientShots } = body;
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  if (!isValidObjectId(projectId)) {
    return NextResponse.json(
      {
        error:
          'This project is not saved to the cloud yet. Create it while signed in (or re-save) so it gets a real project ID, then publish.',
        code: 'INVALID_PROJECT_ID',
      },
      { status: 400 }
    );
  }

  await dbConnect();
  const project = await Project.findOne({ _id: projectId, userId: auth.userId });
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found. Save the project first, then publish.', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Accept latest shots from client so preview uses newest clips even if autosave lagged
  if (Array.isArray(clientShots) && clientShots.length > 0) {
    project.shots = clientShots;
    project.markModified('shots');
  }

  const shots = (project.shots || []) as Array<{ videoUrl?: string; imageUrl?: string }>;
  const firstVideo = shots.find((s) => s.videoUrl)?.videoUrl;
  const firstImage = shots.find((s) => s.imageUrl)?.imageUrl;
  const preview = firstVideo || firstImage;

  if (!preview) {
    return NextResponse.json(
      {
        error:
          'Generate at least one frame or video clip before publishing. The feed needs something to watch.',
        code: 'NO_MEDIA',
      },
      { status: 400 }
    );
  }

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
      previewClip: preview,
      $setOnInsert: { likeCount: 0, commentCount: 0, ratingAvg: 0, ratingCount: 0 },
    },
    { upsert: true, new: true }
  );

  try {
    const user = await User.findById(auth.userId);
    if (user?.email) {
      const filmUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moviedirector-psi.vercel.app'}/?film=${feedItem._id}`;
      sendPublishNotification(user.email, user.username, project.title, filmUrl).catch(() => {});
    }
  } catch {
    /* best effort */
  }

  return NextResponse.json({
    success: true,
    feedItem: serializeFeedItem(feedItem.toObject()),
    previewClip: preview,
    hasVideo: !!firstVideo,
  });
}
