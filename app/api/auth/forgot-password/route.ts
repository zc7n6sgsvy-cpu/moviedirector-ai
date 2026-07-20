import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/sendgrid';

export async function POST(request: NextRequest) {
  const limited = await rateLimit(`forgot:${clientIp(request)}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  await dbConnect();
  const { username } = await request.json();

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  const user = await User.findOne({ username: username.toLowerCase() });

  // Always respond success to avoid user enumeration
  if (!user || !user.email) {
    return NextResponse.json({ success: true });
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  user.resetPasswordToken = token;
  user.resetPasswordExpires = expires;
  await user.save();

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?reset=${token}`;

  await sendPasswordResetEmail(user.email, user.username, resetUrl);

  return NextResponse.json({ success: true });
}
