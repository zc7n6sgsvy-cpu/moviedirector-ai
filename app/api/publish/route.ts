import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import FeedItem from '@/models/FeedItem';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId } = await request.json();
  const project = await Project.findOne({ _id: projectId, userId: user.userId });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  project.isPublic = true;
  await project.save();

  // Upsert feed item
  await FeedItem.findOneAndUpdate(
    { projectId },
    {
      projectId,
      creatorId: user.userId,
      creatorUsername: user.username,
      title: project.title,
      logline: project.logline,
      publishedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true });
}
