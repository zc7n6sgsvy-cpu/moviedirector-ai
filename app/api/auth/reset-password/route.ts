import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  await dbConnect();
  const { token, newPassword } = await request.json();

  if (!token || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = passwordHash;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return NextResponse.json({ success: true });
}
