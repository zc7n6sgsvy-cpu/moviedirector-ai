import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const limited = rateLimit(`login:${clientIp(request)}`, 30, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  await dbConnect();
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = jwt.sign(
    { userId: user._id.toString(), username: user.username },
    getJwtSecret(),
    { expiresIn: '7d' }
  );

  return NextResponse.json({ token, user: { id: user._id.toString(), username: user.username } });
}