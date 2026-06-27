import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Channel from '@/models/Channel';
import { requireAuth } from '@/lib/auth';
import { serializeDoc } from '@/lib/serialize';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const channels = await Channel.find({ userId: auth.userId }).sort({ updatedAt: -1 });
  return NextResponse.json(channels.map((c) => serializeDoc(c.toObject())));
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
    price: Number(price) || 9,
    projectIds: [],
  });

  return NextResponse.json(serializeDoc(channel.toObject()));
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { channelId, projectId, action } = await req.json();
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  await dbConnect();
  const channel = await Channel.findOne({ _id: channelId, userId: auth.userId });
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  if (action === 'add' && projectId) {
    if (!channel.projectIds.map(String).includes(projectId)) {
      channel.projectIds.push(projectId);
      await channel.save();
    }
  } else if (action === 'remove' && projectId) {
    channel.projectIds = channel.projectIds.filter((id) => id.toString() !== projectId);
    await channel.save();
  }

  return NextResponse.json(serializeDoc(channel.toObject()));
}