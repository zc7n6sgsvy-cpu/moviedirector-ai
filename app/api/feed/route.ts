import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';
import { serializeFeedItem } from '@/lib/serialize';
import {
  FEED_ALGORITHM_META,
  rankFeedItems,
  type FeedRankInput,
} from '@/lib/feed-algorithm';

/**
 * GET /api/feed
 *
 * Repertory Rotation (anti-decay): films stay in a living catalog.
 * Not a death-by-recency timeline. See lib/feed-algorithm.ts.
 *
 * Query:
 *  - limit (default 24, max 50)
 *  - offset (default 0) — preferred for ranked catalog pages
 *  - cursor — legacy publishedAt cursor (still works as offset fallback)
 *  - mode=chrono — escape hatch: pure newest-first
 */
export async function GET(req: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 24)));
  const offset = Math.max(0, Number(searchParams.get('offset') || 0));
  const cursor = searchParams.get('cursor');
  const mode = searchParams.get('mode') || 'repertoire';

  // Pull a working set large enough to rank fairly, then slice.
  // (True infinite catalog later: precomputed scores / secondary indexes.)
  const RANK_POOL = Math.min(400, Math.max(80, (offset + limit) * 4));

  if (mode === 'chrono') {
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
      offset: null,
      algorithm: { ...FEED_ALGORITHM_META, mode: 'chrono' },
    });
  }

  const raw = await FeedItem.find({})
    .sort({ publishedAt: -1 })
    .limit(RANK_POOL)
    .lean();

  const inputs: (FeedRankInput & Record<string, unknown>)[] = raw.map((doc) => {
    const id = (doc as { _id: { toString: () => string } })._id.toString();
    const d = doc as {
      publishedAt?: Date;
      likeCount?: number;
      commentCount?: number;
      ratingAvg?: number;
      ratingCount?: number;
      impressionCount?: number;
      watchCount?: number;
      lastWatchedAt?: Date;
    };
    return {
      ...doc,
      id,
      publishedAt: d.publishedAt || new Date(0),
      likeCount: d.likeCount || 0,
      commentCount: d.commentCount || 0,
      ratingAvg: d.ratingAvg || 0,
      ratingCount: d.ratingCount || 0,
      impressionCount: d.impressionCount || 0,
      watchCount: d.watchCount || d.impressionCount || 0,
      lastWatchedAt: d.lastWatchedAt || null,
    };
  });

  const ranked = rankFeedItems(inputs);
  const pageSlice = ranked.slice(offset, offset + limit);
  const hasMore = offset + limit < ranked.length;
  const nextOffset = hasMore ? offset + limit : null;

  const items = pageSlice.map((row) => {
    const { feedScore, feedLane, feedReasons, id, ...rest } = row;
    const serialized = serializeFeedItem({
      ...rest,
      _id: id,
      feedScore,
      feedLane,
      feedReasons,
    });
    return {
      ...serialized,
      id,
      feedScore,
      feedLane,
      feedReasons,
    };
  });

  return NextResponse.json({
    items,
    hasMore,
    nextOffset,
    /** Keep cursor field for older clients — map to offset string */
    nextCursor: nextOffset != null ? `offset:${nextOffset}` : null,
    offset,
    algorithm: {
      ...FEED_ALGORITHM_META,
      mode: 'repertoire',
      poolSize: ranked.length,
    },
  });
}
