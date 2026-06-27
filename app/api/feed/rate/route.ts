import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';
import Rating from '@/models/Rating';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

async function recalcRating(feedItemId: string) {
  const oid = new mongoose.Types.ObjectId(feedItemId);
  const stats = await Rating.aggregate([
    { $match: { feedItemId: oid } },
    { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
  ]);
  const ratingAvg = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
  const ratingCount = stats[0]?.count ?? 0;
  await FeedItem.findByIdAndUpdate(feedItemId, { ratingAvg, ratingCount });
  return { ratingAvg, ratingCount };
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`rate:${auth.userId}:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { feedItemId, score } = await req.json();
  if (!feedItemId || !score) {
    return NextResponse.json({ error: 'feedItemId and score required' }, { status: 400 });
  }

  const numericScore = Number(score);
  if (numericScore < 1 || numericScore > 5 || !Number.isInteger(numericScore)) {
    return NextResponse.json({ error: 'Score must be 1-5' }, { status: 400 });
  }

  await dbConnect();
  const feedItem = await FeedItem.findById(feedItemId);
  if (!feedItem) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  await Rating.findOneAndUpdate(
    { userId: auth.userId, feedItemId },
    { score: numericScore },
    { upsert: true, new: true }
  );

  const { ratingAvg, ratingCount } = await recalcRating(feedItemId);

  return NextResponse.json({ score: numericScore, ratingAvg, ratingCount });
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const feedItemId = new URL(req.url).searchParams.get('feedItemId');
  if (!feedItemId) return NextResponse.json({ error: 'feedItemId required' }, { status: 400 });

  await dbConnect();
  const rating = await Rating.findOne({ userId: auth.userId, feedItemId });
  return NextResponse.json({ score: rating?.score ?? null });
}