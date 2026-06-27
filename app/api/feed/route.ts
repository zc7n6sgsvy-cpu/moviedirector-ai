import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';
import { serializeFeedItem } from '@/lib/serialize';

export async function GET(req: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
  const cursor = searchParams.get('cursor');

  const query: Record<string, unknown> = {};
  if (cursor) {
    query.publishedAt = { $lt: new Date(cursor) };
  }

  const items = await FeedItem.find(query)
    .sort({ publishedAt: -1 })
    .limit(limit + 1);

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1].publishedAt.toISOString() : null;

  return NextResponse.json({
    items: page.map((item) => serializeFeedItem(item.toObject())),
    nextCursor,
    hasMore,
  });
}