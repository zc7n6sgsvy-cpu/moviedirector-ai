import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get('with');
  const cursor = searchParams.get('cursor');
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

  if (otherUserId) {
    const query: Record<string, unknown> = {
      $or: [
        { fromUserId: auth.userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: auth.userId },
      ],
    };
    if (cursor) query.createdAt = { $lt: new Date(cursor) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const chronological = [...page].reverse();

    await Message.updateMany(
      { toUserId: auth.userId, fromUserId: otherUserId, read: false },
      { read: true }
    );

    const otherUser = await User.findById(otherUserId).select('username displayName');

    return NextResponse.json({
      messages: chronological.map((m) => ({
        id: m._id.toString(),
        fromUserId: m.fromUserId.toString(),
        toUserId: m.toUserId.toString(),
        content: m.content,
        filmId: m.filmId,
        createdAt: m.createdAt.toISOString(),
        read: m.read,
      })),
      otherUser: otherUser ? {
        id: otherUser._id.toString(),
        username: otherUser.username,
        displayName: otherUser.displayName || otherUser.username,
      } : { id: otherUserId, username: 'user' },
      nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
      hasMore,
    });
  }

  const userId = new mongoose.Types.ObjectId(auth.userId);
  const conversations = await Message.aggregate([
    { $match: { $or: [{ fromUserId: userId }, { toUserId: userId }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$fromUserId', userId] }, '$toUserId', '$fromUserId'],
        },
        lastMessage: { $first: '$content' },
        lastAt: { $first: '$createdAt' },
        unread: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$toUserId', userId] }, { $eq: ['$read', false] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ]);

  return NextResponse.json(
    conversations.map((c) => ({
      userId: c._id.toString(),
      username: c.user?.username || 'unknown',
      displayName: c.user?.displayName || c.user?.username || 'unknown',
      lastMessage: c.lastMessage,
      lastAt: c.lastAt,
      unread: c.unread,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = rateLimit(`msg:${auth.userId}:${clientIp(request)}`, 100, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { toUserId, content, filmId } = await request.json();
  if (!toUserId || !content?.trim()) {
    return NextResponse.json({ error: 'toUserId and content required' }, { status: 400 });
  }
  if (content.trim().length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  await dbConnect();
  const recipient = await User.findById(toUserId);
  if (!recipient) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (toUserId === auth.userId) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  }

  const message = await Message.create({
    fromUserId: auth.userId,
    toUserId,
    content: content.trim(),
    filmId,
  });

  return NextResponse.json({
    id: message._id.toString(),
    fromUserId: message.fromUserId.toString(),
    toUserId: message.toUserId.toString(),
    content: message.content,
    filmId: message.filmId,
    createdAt: message.createdAt.toISOString(),
  });
}