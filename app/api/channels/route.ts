import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Channel from '@/models/Channel';
import ChannelSubscription from '@/models/ChannelSubscription';
import Project from '@/models/Project';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';

async function enrichChannels(channels: Array<{ _id: { toString: () => string }; projectIds: unknown[]; toObject: () => object }>) {
  const channelIds = channels.map((c) => c._id);
  const subCounts = await ChannelSubscription.aggregate([
    { $match: { channelId: { $in: channelIds } } },
    { $group: { _id: '$channelId', count: { $sum: 1 } } },
  ]);
  const subMap = Object.fromEntries(subCounts.map((s) => [s._id.toString(), s.count]));

  return channels.map((c) => ({
    ...serializeDoc(c.toObject()),
    projectIds: (c.projectIds as { toString: () => string }[]).map((id) => id.toString()),
    subscriberCount: subMap[c._id.toString()] || 0,
  }));
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const channels = await Channel.find({ userId: auth.userId }).sort({ updatedAt: -1 });
  return NextResponse.json(await enrichChannels(channels));
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, description, price } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  await dbConnect();
  const channel = await Channel.create({
    userId: auth.userId,
    name: name.trim(),
    description: description || '',
    price: Math.max(0, Number(price) || 9),
    projectIds: [],
  });

  return NextResponse.json({
    ...serializeDoc(channel.toObject()),
    projectIds: [],
    subscriberCount: 0,
  });
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { channelId, projectId, action, name, description, price } = await req.json();
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  await dbConnect();
  const channel = await Channel.findOne({ _id: channelId, userId: auth.userId });
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  if (action === 'add' && projectId) {
    const project = await Project.findOne({ _id: projectId, userId: auth.userId });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!channel.projectIds.map(String).includes(projectId)) {
      channel.projectIds.push(projectId);
      await channel.save();
    }
  } else if (action === 'remove' && projectId) {
    channel.projectIds = channel.projectIds.filter((id) => id.toString() !== projectId);
    await channel.save();
  } else if (action === 'update') {
    if (name) channel.name = name.trim();
    if (description !== undefined) channel.description = description;
    if (price !== undefined) channel.price = Math.max(0, Number(price));
    await channel.save();
  }

  const count = await ChannelSubscription.countDocuments({ channelId });
  return NextResponse.json({
    ...serializeDoc(channel.toObject()),
    projectIds: channel.projectIds.map((id) => id.toString()),
    subscriberCount: count,
  });
}