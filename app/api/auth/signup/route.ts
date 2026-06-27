import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const limited = rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many signups. Try again later.' }, { status: 429 });
  }

  await dbConnect();
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  if (!/^[a-z0-9_]{3,24}$/.test(username.toLowerCase())) {
    return NextResponse.json({ error: 'Username must be 3-24 chars: letters, numbers, underscore' }, { status: 400 });
  }

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'Username taken' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username: username.toLowerCase(), passwordHash });

  const token = jwt.sign(
    { userId: user._id.toString(), username: user.username },
    getJwtSecret(),
    { expiresIn: '7d' }
  );

  return NextResponse.json({ token, user: { id: user._id.toString(), username: user.username } });
}