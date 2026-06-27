import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { escapeRegex } from '@/lib/ids';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  await dbConnect();
  const users = await User.find({
    username: { $regex: escapeRegex(q), $options: 'i' },
    _id: { $ne: auth.userId },
  })
    .select('username displayName bio')
    .limit(10);

  return NextResponse.json(users.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    displayName: u.displayName || u.username,
    bio: u.bio || '',
  })));
}