import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import FeedItem from '@/models/FeedItem';
import Channel from '@/models/Channel';
import ChannelSubscription from '@/models/ChannelSubscription';
import Project from '@/models/Project';
import { getUserFromToken } from '@/lib/auth';
import { serializeFeedItem } from '@/lib/serialize';

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  await dbConnect();

  const user = await User.findOne({ username: username.toLowerCase() }).select('-passwordHash');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const viewer = getUserFromToken(req);

  const [films, channels] = await Promise.all([
    FeedItem.find({ creatorId: user._id }).sort({ publishedAt: -1 }).limit(50),
    Channel.find({ userId: user._id }).sort({ updatedAt: -1 }),
  ]);

  const channelIds = channels.map((c) => c._id);
  const subCounts = await ChannelSubscription.aggregate([
    { $match: { channelId: { $in: channelIds } } },
    { $group: { _id: '$channelId', count: { $sum: 1 } } },
  ]);
  const subCountMap = Object.fromEntries(subCounts.map((s) => [s._id.toString(), s.count]));

  let viewerSubs = new Set<string>();
  if (viewer) {
    const subs = await ChannelSubscription.find({
      userId: viewer.userId,
      channelId: { $in: channelIds },
    });
    viewerSubs = new Set(subs.map((s) => s.channelId.toString()));
  }

  const allProjectIds = channels.flatMap((c) => c.projectIds.map(String));
  const projects = allProjectIds.length
    ? await Project.find({ _id: { $in: allProjectIds } }).select('title type logline')
    : [];

  const projectMap = Object.fromEntries(projects.map((p) => [p._id.toString(), p]));

  const avgRating =
    films.length > 0
      ? Math.round((films.reduce((a, f) => a + (f.ratingAvg || 0), 0) / films.length) * 10) / 10
      : 0;

  return NextResponse.json({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl,
    isOwnProfile: viewer?.userId === user._id.toString(),
    stats: {
      films: films.length,
      avgRating,
      totalSubscribers: subCounts.reduce((a, s) => a + s.count, 0),
    },
    films: films.map((f) => serializeFeedItem(f.toObject())),
    channels: channels.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description,
      price: c.price,
      subscriberCount: subCountMap[c._id.toString()] || 0,
      isSubscribed: viewerSubs.has(c._id.toString()),
      episodes: c.projectIds.map((pid) => {
        const p = projectMap[pid.toString()];
        return p ? { id: p._id.toString(), title: p.title, type: p.type, logline: p.logline } : null;
      }).filter(Boolean),
    })),
  });
}