import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Comment from '@/models/Comment';
import FeedItem from '@/models/FeedItem';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const feedItemId = searchParams.get('feedItemId');
  const cursor = searchParams.get('cursor');
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 30)));

  if (!feedItemId) {
    return NextResponse.json({ error: 'feedItemId required' }, { status: 400 });
  }

  const query: Record<string, unknown> = {
    feedItemId: new mongoose.Types.ObjectId(feedItemId),
    parentId: { $exists: false },
  };
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = comments.length > limit;
  const page = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  const commentIds = page.map((c) => c._id);
  const replies = await Comment.find({ parentId: { $in: commentIds } }).sort({ createdAt: 1 });

  const items = page.map((c) => ({
    id: c._id.toString(),
    feedItemId: c.feedItemId.toString(),
    userId: c.userId.toString(),
    username: c.username,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    replies: replies
      .filter((r) => r.parentId?.toString() === c._id.toString())
      .map((r) => ({
        id: r._id.toString(),
        userId: r.userId.toString(),
        username: r.username,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
  }));

  return NextResponse.json({ items, nextCursor, hasMore });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`comment:${auth.userId}:${clientIp(req)}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { feedItemId, content, parentId } = await req.json();
  if (!feedItemId || !content?.trim()) {
    return NextResponse.json({ error: 'feedItemId and content required' }, { status: 400 });
  }
  if (content.trim().length > 2000) {
    return NextResponse.json({ error: 'Comment too long (max 2000 chars)' }, { status: 400 });
  }

  await dbConnect();
  const feedItem = await FeedItem.findById(feedItemId);
  if (!feedItem) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const comment = await Comment.create({
    feedItemId,
    userId: auth.userId,
    username: auth.username,
    content: content.trim(),
    parentId: parentId || undefined,
  });

  if (!parentId) {
    await FeedItem.findByIdAndUpdate(feedItemId, { $inc: { commentCount: 1 } });
  }

  return NextResponse.json({
    id: comment._id.toString(),
    feedItemId: comment.feedItemId.toString(),
    userId: comment.userId.toString(),
    username: comment.username,
    content: comment.content,
    parentId: comment.parentId?.toString(),
    createdAt: comment.createdAt.toISOString(),
  });
}