import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Channel from '@/models/Channel';
import ChannelSubscription from '@/models/ChannelSubscription';
import Project from '@/models/Project';
import User from '@/models/User';
import { requireAuth, getUserFromToken } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const channel = await Channel.findById(id);
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  const owner = await User.findById(channel.userId).select('username displayName bio');
  const subscriberCount = await ChannelSubscription.countDocuments({ channelId: id });
  const viewer = getUserFromToken(req);
  const isSubscribed = viewer
    ? !!(await ChannelSubscription.findOne({ userId: viewer.userId, channelId: id }))
    : false;

  const projects = channel.projectIds.length
    ? await Project.find({ _id: { $in: channel.projectIds } }).select('title type logline shots')
    : [];

  return NextResponse.json({
    ...serializeDoc(channel.toObject()),
    owner: owner ? {
      id: owner._id.toString(),
      username: owner.username,
      displayName: owner.displayName || owner.username,
      bio: owner.bio,
    } : null,
    subscriberCount,
    isSubscribed,
    episodes: projects.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      type: p.type,
      logline: p.logline,
      clipCount: (p.shots || []).filter((s: { videoUrl?: string }) => s.videoUrl).length,
    })),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await dbConnect();

  const result = await Channel.deleteOne({ _id: id, userId: auth.userId });
  if (!result.deletedCount) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  await ChannelSubscription.deleteMany({ channelId: id });
  return NextResponse.json({ success: true });
}