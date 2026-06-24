import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export async function POST(request: NextRequest) {
  await dbConnect();
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'Username taken' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username: username.toLowerCase(), passwordHash });

  const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  return NextResponse.json({ token, user: { id: user._id, username: user.username } });
}
