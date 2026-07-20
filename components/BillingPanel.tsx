'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

type PlanCard = {
  id: string;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  monthlyCredits: number;
  signupCredits: number;
  maxProjects: number;
  features: string[];
  highlighted?: boolean;
};

type PackCard = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  bestValue?: boolean;
};

type BillingAccount = {
  plan: string;
  planName: string;
  planStatus: string;
  creditBalance: number;
  lifetimeCreditsUsed: number;
  monthlyCredits: number;
  priceMonthlyUsd: number;
  paymentsReady: boolean;
  hasStripeCustomer: boolean;
  costs: { imageCredits: number; videoCreditsPerSecond: number; video8s: number };
  firstCut?: {
    status: string;
    freeImagesRemaining: number;
    freeVideosRemaining: number;
  };
  trial?: {
    active: boolean;
    endsAt: string | null;
    hasUsedTrial: boolean;
    days: number;
    credits: number;
  };
  funnel?: { recommend: string };
  catalog: {
    plans: PlanCard[];
    creditPacks: PackCard[];
  };
  recentUsage: Array<{
    id: string;
    type: string;
    credits: number;
    description?: string;
    createdAt: string;
  }>;
};

export default function BillingPanel({
  token,
  onClose,
  onAuthRequired,
  onStartFirstCut,
  onStartTrial,
}: {
  token: string | null;
  onClose?: () => void;
  onAuthRequired?: () => void;
  onStartFirstCut?: () => void;
  onStartTrial?: (mode: 'platform' | 'stripe') => Promise<void>;
}) {
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/billing/account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load billing');
      setAccount(await res.json());
    } catch {
      toast.error('Could not load billing account');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkout(body: Record<string, string>) {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    setBusy(JSON.stringify(body));
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'STRIPE_NOT_CONFIGURED' || data.code === 'PRICE_NOT_CONFIGURED') {
          toast.error(data.error || 'Payments not configured yet', {
            description: 'Set Stripe keys + price IDs in env, then retry.',
          });
        } else {
          toast.error(data.error || 'Checkout failed');
        }
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Checkout failed');
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    setBusy('portal');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not open billing portal');
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error('Portal failed');
    } finally {
      setBusy(null);
    }
  }

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="font-display text-5xl mb-4">Billing</div>
        <p className="text-white/60 mb-6">Sign in to manage membership and credits.</p>
        <button onClick={onAuthRequired} className="btn-gold px-8 py-3 rounded-full text-black">
          Sign in
        </button>
      </div>
    );
  }

  if (loading || !account) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-white/50">
        Loading billing…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="uppercase tracking-[3px] text-xs text-[var(--gold)] mb-1">REVENUE ENGINE</div>
          <h1 className="font-display text-5xl tracking-tight">Membership & Credits</h1>
          <p className="text-white/60 mt-2 max-w-xl">
            Monthly plan for predictable access. Credits for every frame and clip. Top up anytime —
            pay only for what you generate.
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-full text-sm">
            Close
          </button>
        )}
      </div>

      {/* Funnel CTA */}
      {account.funnel?.recommend === 'first_cut' && (
        <div className="mb-6 p-5 rounded-3xl border border-[var(--gold)]/40 bg-[var(--gold)]/5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-[var(--gold)] mb-1">FREE PATH</div>
            <div className="font-display text-2xl">Start your First Cut sample</div>
            <p className="text-sm text-white/60 mt-1">
              Sitcom pilot, short film, commercial, or launch trailer — 3 free frames + 2 free clips. No card.
            </p>
          </div>
          <button onClick={onStartFirstCut} className="btn-gold px-6 py-2.5 rounded-2xl text-black text-sm">
            Open First Cut
          </button>
        </div>
      )}
      {account.funnel?.recommend === 'start_trial' && !account.trial?.active && (
        <div className="mb-6 p-5 rounded-3xl border border-[var(--gold)]/40 bg-[var(--gold)]/5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-[var(--gold)] mb-1">FREE TRIAL</div>
            <div className="font-display text-2xl">7 days of Creator · 500 credits</div>
            <p className="text-sm text-white/60 mt-1">
              Unlock full generation after your sample. No card platform trial, or Stripe trial ($0 today).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onStartTrial?.('platform')}
              className="btn-gold px-5 py-2.5 rounded-2xl text-black text-sm"
            >
              Start free trial
            </button>
            <button
              onClick={() => onStartTrial?.('stripe')}
              className="btn-outline px-5 py-2.5 rounded-2xl text-sm"
            >
              Via Stripe
            </button>
          </div>
        </div>
      )}

      {/* Balance card */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="director-card p-6 rounded-3xl md:col-span-2">
          <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Current plan</div>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="font-display text-4xl text-[var(--gold)]">{account.planName}</div>
            <div className="text-white/50">
              {account.trial?.active
                ? `Trial · ends ${account.trial.endsAt ? new Date(account.trial.endsAt).toLocaleDateString() : 'soon'}`
                : account.priceMonthlyUsd > 0
                  ? `$${account.priceMonthlyUsd}/mo`
                  : 'Free'}{' '}
              · {account.planStatus}
            </div>
          </div>
          {account.firstCut && (
            <div className="mt-3 text-xs text-white/50">
              First Cut: <span className="text-white/80">{account.firstCut.status}</span>
              {account.firstCut.status === 'in_progress' && (
                <> · free frames {account.firstCut.freeImagesRemaining} · free clips {account.firstCut.freeVideosRemaining}</>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-8">
            <div>
              <div className="text-xs text-white/50">CREDIT BALANCE</div>
              <div className="font-mono text-3xl">{account.creditBalance}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">LIFETIME USED</div>
              <div className="font-mono text-3xl">{account.lifetimeCreditsUsed}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">USAGE RATES</div>
              <div className="text-sm text-white/70 mt-1">
                Image: {account.costs.imageCredits} cr · Video: {account.costs.videoCreditsPerSecond} cr/s
                <br />
                8s clip ≈ {account.costs.video8s} credits
              </div>
            </div>
          </div>
          {!account.paymentsReady && (
            <div className="mt-4 text-xs text-amber-400/90 border border-amber-400/30 rounded-xl px-3 py-2">
              Stripe not fully configured on this deployment. Plans & packs show correctly; checkout
              activates when STRIPE_* env vars are set.
            </div>
          )}
        </div>
        <div className="director-card p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Manage</div>
            <p className="text-sm text-white/60">Update card, cancel, or download invoices via Stripe portal.</p>
          </div>
          <button
            onClick={openPortal}
            disabled={!!busy}
            className="btn-outline mt-4 w-full py-3 rounded-2xl text-sm disabled:opacity-40"
          >
            {busy === 'portal' ? 'Opening…' : 'Open billing portal'}
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-3xl">Membership plans</div>
        <div className="text-xs text-white/40">Membership fee + included monthly credits</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {account.catalog.plans.map((plan) => {
          const isCurrent = plan.id === account.plan;
          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-5 border flex flex-col ${
                plan.highlighted
                  ? 'border-[var(--gold)]/60 bg-[var(--gold)]/5'
                  : 'border-white/10 bg-[#0a0a0a]'
              }`}
            >
              {plan.highlighted && (
                <div className="text-[10px] tracking-widest text-[var(--gold)] mb-2">MOST POPULAR</div>
              )}
              <div className="font-display text-2xl">{plan.name}</div>
              <div className="text-white/50 text-sm mt-1 min-h-[40px]">{plan.tagline}</div>
              <div className="mt-4 mb-4">
                <span className="font-mono text-3xl">
                  {plan.priceMonthlyUsd === 0 ? '$0' : `$${plan.priceMonthlyUsd}`}
                </span>
                <span className="text-white/40 text-sm">/mo</span>
              </div>
              <div className="text-sm text-[var(--gold)] mb-3">
                {plan.monthlyCredits > 0
                  ? `${plan.monthlyCredits.toLocaleString()} credits / month`
                  : `${plan.signupCredits} starter credits`}
              </div>
              <ul className="text-xs text-white/60 space-y-1.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {plan.id === 'free' ? (
                <div className="text-center text-xs text-white/40 py-2">
                  {isCurrent ? 'Your current plan' : 'Included on signup'}
                </div>
              ) : (
                <button
                  disabled={isCurrent || !!busy}
                  onClick={() => checkout({ mode: 'subscription', planId: plan.id })}
                  className={`w-full py-2.5 rounded-2xl text-sm ${
                    isCurrent ? 'bg-white/10 text-white/40' : 'btn-gold text-black'
                  } disabled:opacity-50`}
                >
                  {isCurrent ? 'Current plan' : busy?.includes(plan.id) ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Credit packs */}
      <div className="mb-4">
        <div className="font-display text-3xl">Credit packs — pay per use</div>
        <p className="text-sm text-white/50 mt-1">
          Stack on any plan. Never blocked mid-batch if you top up.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mb-12">
        {account.catalog.creditPacks.map((pack) => (
          <div
            key={pack.id}
            className={`rounded-3xl p-5 border ${
              pack.bestValue ? 'border-[var(--gold)]/50 bg-[#111]' : 'border-white/10 bg-[#0a0a0a]'
            }`}
          >
            {pack.bestValue && (
              <div className="text-[10px] tracking-widest text-[var(--gold)] mb-2">BEST VALUE</div>
            )}
            <div className="font-display text-2xl">{pack.name}</div>
            <div className="font-mono text-3xl mt-2">{pack.credits.toLocaleString()} cr</div>
            <div className="text-white/50 text-sm mb-4">${pack.priceUsd} one-time</div>
            <button
              disabled={!!busy}
              onClick={() => checkout({ mode: 'payment', packId: pack.id })}
              className="btn-outline w-full py-2.5 rounded-2xl text-sm disabled:opacity-40"
            >
              {busy?.includes(pack.id) ? 'Redirecting…' : 'Buy credits'}
            </button>
          </div>
        ))}
      </div>

      {/* Usage log */}
      <div className="director-card rounded-3xl p-6">
        <div className="font-display text-2xl mb-4">Recent usage</div>
        {account.recentUsage.length === 0 ? (
          <div className="text-white/40 text-sm">No usage yet. Generate a frame to see charges here.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {account.recentUsage.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between text-sm border-b border-white/5 py-2"
              >
                <div>
                  <div className="text-white/80">{e.description || e.type}</div>
                  <div className="text-[10px] text-white/40">
                    {new Date(e.createdAt).toLocaleString()} · {e.type}
                  </div>
                </div>
                <div className={`font-mono ${e.credits >= 0 ? 'text-emerald-400' : 'text-white/70'}`}>
                  {e.credits >= 0 ? '+' : ''}
                  {e.credits}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
