import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { grantCredits, setUserPlan } from '@/lib/billing';
import { CREDIT_PACKS, PLANS, type PlanId, type CreditPackId } from '@/lib/plans';

export const runtime = 'nodejs';

function planFromPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripePriceEnv) continue;
    if (process.env[plan.stripePriceEnv] === priceId) return plan.id;
  }
  return null;
}

function packFromPriceId(priceId: string | undefined) {
  if (!priceId) return null;
  return (
    CREDIT_PACKS.find((p) => process.env[p.stripePriceEnv] === priceId) || null
  );
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await dbConnect();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id;
        if (!userId) break;

        if (session.mode === 'subscription') {
          const planId = (session.metadata?.planId || 'creator') as PlanId;
          const isTrial = session.metadata?.kind === 'trial_membership';
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id;
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id;

          await setUserPlan(userId, planId, {
            stripeSubscriptionId: subId || null,
            stripeCustomerId: customerId || null,
            planStatus: isTrial ? 'trialing' : 'active',
            grantMonthlyCredits: true,
            stripeEventId: `${event.id}:plan_grant`,
          });
          if (isTrial) {
            const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await User.findByIdAndUpdate(userId, {
              $set: { hasUsedTrial: true, trialEndsAt: ends, planStatus: 'trialing' },
            });
          }
        }

        if (session.mode === 'payment' && session.metadata?.kind === 'credit_pack') {
          const packId = session.metadata.packId as CreditPackId;
          const pack = CREDIT_PACKS.find((p) => p.id === packId);
          const credits = pack?.credits || Number(session.metadata.credits || 0);
          if (credits > 0) {
            await grantCredits(userId, credits, 'pack_purchase', {
              description: `Purchased ${pack?.name || packId}`,
              stripeEventId: event.id,
              metadata: { packId, sessionId: session.id },
            });
          }
          if (session.customer && typeof session.customer === 'string') {
            await User.findByIdAndUpdate(userId, {
              $set: { stripeCustomerId: session.customer },
            });
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // Renewals after first invoice — grant monthly credits
        if (invoice.billing_reason === 'subscription_cycle') {
          const parentSub = invoice.parent?.subscription_details?.subscription;
          const subId =
            typeof parentSub === 'string' ? parentSub : parentSub?.id || null;
          if (!subId) break;

          const user = await User.findOne({ stripeSubscriptionId: subId });
          if (!user) break;

          const line = invoice.lines?.data?.[0];
          const priceId =
            line?.pricing?.price_details?.price ||
            (line as { price?: { id?: string } })?.price?.id;
          const planId =
            planFromPriceId(typeof priceId === 'string' ? priceId : undefined) ||
            (user.plan as PlanId) ||
            'creator';
          const periodEnd = line?.period?.end
            ? new Date(line.period.end * 1000)
            : undefined;

          await setUserPlan(user._id.toString(), planId, {
            planStatus: 'active',
            currentPeriodEnd: periodEnd || null,
            grantMonthlyCredits: true,
            stripeEventId: `${event.id}:renewal`,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await User.findOne({
          $or: [
            { stripeSubscriptionId: sub.id },
            { stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id },
          ],
        });
        if (!user) break;

        const priceId = sub.items.data[0]?.price?.id;
        const planId = planFromPriceId(priceId) || (user.plan as PlanId);
        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trialing',
          incomplete: 'incomplete',
          unpaid: 'past_due',
        };

        const periodEndUnix =
          (sub as { current_period_end?: number }).current_period_end ||
          sub.items?.data?.[0]?.current_period_end;

        await setUserPlan(user._id.toString(), planId, {
          stripeSubscriptionId: sub.id,
          planStatus: statusMap[sub.status] || 'active',
          currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
          grantMonthlyCredits: false,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await User.findOne({ stripeSubscriptionId: sub.id });
        if (!user) break;
        await setUserPlan(user._id.toString(), 'free', {
          stripeSubscriptionId: null,
          planStatus: 'canceled',
          currentPeriodEnd: null,
          grantMonthlyCredits: false,
        });
        break;
      }

      case 'checkout.session.async_payment_failed':
      case 'invoice.payment_failed': {
        // Soft mark past_due when we can resolve the user
        const obj = event.data.object as { customer?: string | { id?: string }; subscription?: string };
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        if (customerId) {
          await User.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { $set: { planStatus: 'past_due' } }
          );
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
