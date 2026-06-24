import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  await dbConnect();
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get('with');

  if (otherUserId) {
    // Get messages between current and other user
    const messages = await Message.find({
      $or: [
        { fromUserId: user.userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: user.userId }
      ]
    }).sort({ createdAt: 1 });

    // Mark as read
    await Message.updateMany(
      { toUserId: user.userId, fromUserId: otherUserId, read: false },
      { read: true }
    );

    return NextResponse.json(messages);
  } else {
    // Get conversations list (unique users with last message)
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ fromUserId: user.userId }, { toUserId: user.userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$fromUserId', user.userId] }, '$toUserId', '$fromUserId']
          },
          lastMessage: { $first: '$content' },
          lastAt: { $first: '$createdAt' },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$toUserId', user.userId] }, { $eq: ['$read', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { lastAt: -1 } }
    ]);

    return NextResponse.json(conversations);
  }
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { toUserId, content, filmId } = await request.json();
  if (!toUserId || !content) {
    return NextResponse.json({ error: 'toUserId and content required' }, { status: 400 });
  }

  const message = await Message.create({
    fromUserId: user.userId,
    toUserId,
    content,
    filmId,
  });

  return NextResponse.json(message);
}
