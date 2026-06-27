import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ChannelSubscription from '@/models/ChannelSubscription';
import Channel from '@/models/Channel';
import User from '@/models/User';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const subs = await ChannelSubscription.find({ userId: auth.userId }).sort({ createdAt: -1 });

  const channels = await Channel.find({ _id: { $in: subs.map((s) => s.channelId) } });
  const owners = await User.find({ _id: { $in: channels.map((c) => c.userId) } }).select('username displayName');
  const ownerMap = Object.fromEntries(owners.map((o) => [o._id.toString(), o]));

  const allProjectIds = channels.flatMap((c) => c.projectIds);
  const projects = allProjectIds.length
    ? await Project.find({ _id: { $in: allProjectIds } }).select('title type')
    : [];
  const projectMap = Object.fromEntries(projects.map((p) => [p._id.toString(), p]));

  return NextResponse.json(
    channels.map((c) => {
      const owner = ownerMap[c.userId.toString()];
      return {
        id: c._id.toString(),
        name: c.name,
        description: c.description,
        price: c.price,
        owner: owner ? { username: owner.username, displayName: owner.displayName || owner.username } : null,
        episodes: c.projectIds.map((pid) => projectMap[pid.toString()]).filter(Boolean),
      };
    })
  );
}