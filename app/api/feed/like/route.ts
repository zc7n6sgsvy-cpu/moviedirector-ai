import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';
import Like from '@/models/Like';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`like:${auth.userId}:${clientIp(req)}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { feedItemId } = await req.json();
  if (!feedItemId) return NextResponse.json({ error: 'feedItemId required' }, { status: 400 });

  await dbConnect();
  const existing = await Like.findOne({ userId: auth.userId, feedItemId });
  if (existing) {
    await existing.deleteOne();
    await FeedItem.findByIdAndUpdate(feedItemId, { $inc: { likeCount: -1 } });
    return NextResponse.json({ liked: false });
  }

  await Like.create({ userId: auth.userId, feedItemId });
  const item = await FeedItem.findByIdAndUpdate(feedItemId, { $inc: { likeCount: 1 } }, { new: true });
  return NextResponse.json({ liked: true, likeCount: item?.likeCount ?? 1 });
}