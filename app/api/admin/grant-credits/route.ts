import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import UsageEvent from '@/models/UsageEvent';
import { grantCredits } from '@/lib/billing';

/**
 * One-shot / ops credit grant.
 * Auth: Authorization: Bearer <ADMIN_GRANT_KEY or ADMIN_OPS_TOKEN env>
 * Body: { username, credits, reason?, idempotencyKey? }
 *
 * Caps: max 500 credits per call. Idempotent via UsageEvent.stripeEventId when key set.
 */
export async function POST(req: NextRequest) {
  const opsKey = process.env.ADMIN_GRANT_KEY || process.env.ADMIN_OPS_TOKEN || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!opsKey || bearer !== opsKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    username?: string;
    credits?: number;
    reason?: string;
    idempotencyKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const username = (body.username || '').trim().toLowerCase().replace(/^@/, '');
  const credits = Math.floor(Number(body.credits) || 0);
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
  if (credits < 1 || credits > 500) {
    return NextResponse.json({ error: 'credits must be 1–500' }, { status: 400 });
  }

  const idem =
    body.idempotencyKey ||
    (username === 'yrt' && credits <= 30 ? 'admin_grant_yrt_about_1usd_v1' : undefined);

  await dbConnect();

  if (idem) {
    const existing = await UsageEvent.findOne({ stripeEventId: idem });
    if (existing) {
      const user = await User.findOne({ username }).select('username creditBalance');
      return NextResponse.json({
        ok: true,
        alreadyGranted: true,
        username: user?.username || username,
        creditBalance: user?.creditBalance ?? null,
        message: 'Idempotent: grant already applied',
      });
    }
  }

  const user = await User.findOne({ username });
  if (!user) {
    return NextResponse.json({ error: `User @${username} not found` }, { status: 404 });
  }

  const updated = await grantCredits(user._id.toString(), credits, 'admin_adjust', {
    description: body.reason || `Ops grant ${credits} credits (~$${((credits / 25) * 1).toFixed(2)} at ~$0.04/cr)`,
    stripeEventId: idem,
    metadata: { ops: true, username },
  });

  return NextResponse.json({
    ok: true,
    username: user.username,
    creditsGranted: credits,
    creditBalance: updated?.creditBalance ?? null,
    message: `Granted ${credits} credits to @${user.username}`,
  });
}
