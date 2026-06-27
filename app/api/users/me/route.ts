import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';
import FeedItem from '@/models/FeedItem';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const user = await User.findById(auth.userId).select('-passwordHash');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const projectCount = await Project.countDocuments({ userId: auth.userId });
  const publishedCount = await FeedItem.countDocuments({ creatorId: auth.userId });

  return NextResponse.json({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl,
    projectCount,
    publishedCount,
    createdAt: user.createdAt,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { displayName, bio } = await req.json();
  await dbConnect();

  const updates: Record<string, string> = {};
  if (displayName !== undefined) updates.displayName = String(displayName).trim().slice(0, 50);
  if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 300);

  const user = await User.findByIdAndUpdate(auth.userId, { $set: updates }, { new: true }).select('-passwordHash');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
  });
}