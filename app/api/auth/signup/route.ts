import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { PLANS } from '@/lib/plans';
import { grantCredits } from '@/lib/billing';

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(`signup:${clientIp(request)}`, 20, 60 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many signups from this network. Wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    let body: { username?: string; password?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { username, password, email } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username.toLowerCase())) {
      return NextResponse.json(
        { error: 'Username must be 3-24 chars: letters, numbers, underscore' },
        { status: 400 }
      );
    }

    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecret();
    } catch {
      console.error('JWT_SECRET missing in production');
      return NextResponse.json(
        {
          error: 'Server auth is not configured (JWT_SECRET). Add it in Vercel env and redeploy.',
          code: 'JWT_SECRET_MISSING',
        },
        { status: 503 }
      );
    }

    await dbConnect();

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'Username taken' }, { status: 409 });
    }

    const freePlan = PLANS.free;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash,
      email: email?.toLowerCase() || undefined,
      plan: 'free',
      planStatus: 'active',
      creditBalance: 0,
      firstCutStatus: 'not_started',
      firstCutFreeImagesRemaining: 5,
      firstCutFreeVideosRemaining: 3,
      hasUsedTrial: false,
      onboardingStep: 'first_cut',
    });

    if (freePlan.signupCredits > 0) {
      await grantCredits(user._id.toString(), freePlan.signupCredits, 'signup_grant', {
        description: `Welcome grant — ${freePlan.signupCredits} credits`,
      }).catch((err) => console.error('signup grantCredits failed', err));
    }

    if (email) {
      import('@/lib/beehiiv').then(({ subscribeToBeehiiv }) => {
        subscribeToBeehiiv(email, username).catch(() => {});
      });
      import('@/lib/sendgrid').then(({ sendWelcomeEmail }) => {
        sendWelcomeEmail(email, username).catch(() => {});
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      jwtSecret,
      { expiresIn: '7d' }
    );

    const refreshed = await User.findById(user._id).select('creditBalance plan');

    return NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        plan: refreshed?.plan || 'free',
        creditBalance: refreshed?.creditBalance ?? 0,
        firstCutStatus: 'not_started',
        onboarding: 'first_cut',
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    const message = err instanceof Error ? err.message : 'Signup failed';
    // Never leak stack; give actionable hints for common ops mistakes
    if (/JWT_SECRET/i.test(message)) {
      return NextResponse.json(
        { error: 'Server auth is not configured (JWT_SECRET). Add it in Vercel and redeploy.', code: 'JWT_SECRET_MISSING' },
        { status: 503 }
      );
    }
    if (/MONGODB|mongo|ServerSelection|whitelist/i.test(message)) {
      return NextResponse.json(
        { error: 'Database unavailable. Check MONGODB_URI and Atlas Network Access.', code: 'DB_ERROR' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Signup failed. Try again in a moment.', code: 'SIGNUP_FAILED' }, { status: 500 });
  }
}