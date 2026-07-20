'use client';

import React, { useState } from 'react';
import { FIRST_CUT_JOURNEY_COPY, TRIAL_DAYS, TRIAL_CREDITS } from '@/lib/first-cut';

type Props = {
  open: boolean;
  onClose: () => void;
  onStartPlatformTrial: () => Promise<void>;
  onStartStripeTrial: () => Promise<void>;
  onOpenBilling: () => void;
  hasUsedTrial?: boolean;
};

export default function TrialOfferModal({
  open,
  onClose,
  onStartPlatformTrial,
  onStartStripeTrial,
  onOpenBilling,
  hasUsedTrial,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!open) return null;

  async function run(mode: 'platform' | 'stripe') {
    setBusy(mode);
    try {
      if (mode === 'platform') await onStartPlatformTrial();
      else await onStartStripeTrial();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/80 p-4">
      <div className="director-card max-w-lg w-full rounded-3xl p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 text-sm">
          Close
        </button>
        <div className="uppercase tracking-[3px] text-xs text-[var(--gold)] mb-2">SAMPLE READY</div>
        <div className="font-display text-3xl mb-3">Unlock the full studio</div>
        <p className="text-white/60 text-sm mb-4">{FIRST_CUT_JOURNEY_COPY.afterSample}</p>
        <ul className="text-sm text-white/70 space-y-2 mb-6">
          <li>· {TRIAL_DAYS}-day Creator trial</li>
          <li>· {TRIAL_CREDITS} credits to finish full sitcoms, commercials, trailers</li>
          <li>· Batch generation + more projects</li>
          <li>· Then $39/mo or stay free for planning only</li>
        </ul>
        <div className="flex flex-col gap-2">
          <button
            disabled={!!busy || hasUsedTrial}
            onClick={() => run('platform')}
            className="btn-gold py-3 rounded-2xl text-black text-sm disabled:opacity-40"
          >
            {hasUsedTrial
              ? 'Trial already used — view plans'
              : busy === 'platform'
                ? 'Starting trial…'
                : 'Start free trial — no card'}
          </button>
          <button
            disabled={!!busy}
            onClick={() => run('stripe')}
            className="btn-outline py-3 rounded-2xl text-sm disabled:opacity-40"
          >
            {busy === 'stripe' ? 'Redirecting…' : 'Start trial via Stripe (card on file, $0 today)'}
          </button>
          <button onClick={onOpenBilling} className="text-xs text-white/50 py-2">
            Compare paid plans →
          </button>
        </div>
      </div>
    </div>
  );
}
