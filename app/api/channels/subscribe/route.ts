import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Channel from '@/models/Channel';
import ChannelSubscription from '@/models/ChannelSubscription';
import { requireAuth } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import User from '@/models/User';
import { sendChannelSubscriptionReceipt } from '@/lib/sendgrid';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limited = await rateLimit(`subscribe:${auth.userId}:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { channelId } = await req.json();
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  await dbConnect();
  const channel = await Channel.findById(channelId);
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  if (channel.userId.toString() === auth.userId) {
    return NextResponse.json({ error: 'Cannot subscribe to your own channel' }, { status: 400 });
  }

  const existing = await ChannelSubscription.findOne({ userId: auth.userId, channelId });
  if (existing) {
    await existing.deleteOne();
    const count = await ChannelSubscription.countDocuments({ channelId });
    return NextResponse.json({ subscribed: false, subscriberCount: count });
  }

  await ChannelSubscription.create({ userId: auth.userId, channelId });

  // Send receipt email (best effort)
  try {
    const user = await User.findById(auth.userId);
    if (user?.email) {
      sendChannelSubscriptionReceipt(user.email, user.username, channel.name, channel.price || 9).catch(() => {});
    }
    // Also try beehiiv
    if (user?.email) {
      import('@/lib/beehiiv').then(m => m.subscribeToBeehiiv(user.email!, user.username).catch(() => {}));
    }
  } catch {}

  const count = await ChannelSubscription.countDocuments({ channelId });
  return NextResponse.json({ subscribed: true, subscriberCount: count });
}