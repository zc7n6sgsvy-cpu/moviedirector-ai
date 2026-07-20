'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FIRST_CUT_JOURNEY_COPY } from '@/lib/first-cut';

type Path = {
  id: string;
  label: string;
  eyebrow: string;
  promise: string;
  sampleOutcome: string;
  prompts: { key: string; label: string; placeholder: string; required?: boolean }[];
};

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onAuthRequired: () => void;
  onProjectReady: (project: Record<string, unknown>, meta: {
    freeImagesRemaining: number;
    freeVideosRemaining: number;
    sampleOutcome?: string;
  }) => void;
  onStartTrial: (mode: 'platform' | 'stripe') => Promise<void>;
  onOpenBilling: () => void;
};

export default function FirstCutWalkthrough({
  open,
  token,
  onClose,
  onAuthRequired,
  onProjectReady,
  onStartTrial,
  onOpenBilling,
}: Props) {
  const [step, setStep] = useState<'path' | 'answers' | 'building' | 'done_offer'>('path');
  const [paths, setPaths] = useState<Path[]>([]);
  const [selected, setSelected] = useState<Path | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [trialBusy, setTrialBusy] = useState<string | null>(null);
  const [userState, setUserState] = useState<{
    firstCutStatus?: string;
    freeImagesRemaining?: number;
    freeVideosRemaining?: number;
    hasUsedTrial?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('path');
    setSelected(null);
    setAnswers({});
    fetch('/api/onboarding/first-cut', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        setPaths(data.paths || []);
        setUserState(data.user);
        if (data.user?.firstCutStatus === 'completed') {
          setStep('done_offer');
        }
      })
      .catch(() => {});
  }, [open, token]);

  if (!open) return null;

  async function createSample() {
    if (!token) {
      onAuthRequired();
      return;
    }
    if (!selected) return;
    for (const p of selected.prompts) {
      if (p.required && !String(answers[p.key] || '').trim()) {
        toast.error(`Add: ${p.label}`);
        return;
      }
    }
    setBusy(true);
    setStep('building');
    try {
      const res = await fetch('/api/onboarding/first-cut', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pathId: selected.id, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create First Cut');

      toast.success(
        data.resumed
          ? 'Resuming your First Cut sample'
          : data.alreadyCompleted
            ? 'Opening your completed First Cut'
            : 'First Cut project ready — generate free frames & clips'
      );

      onProjectReady(data.project, {
        freeImagesRemaining: data.freeImagesRemaining ?? 3,
        freeVideosRemaining: data.freeVideosRemaining ?? 2,
        sampleOutcome: data.guide?.sampleOutcome || selected.sampleOutcome,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      setStep('answers');
    } finally {
      setBusy(false);
    }
  }

  async function startTrial(mode: 'platform' | 'stripe') {
    if (!token) {
      onAuthRequired();
      return;
    }
    setTrialBusy(mode);
    try {
      await onStartTrial(mode);
    } finally {
      setTrialBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 p-4">
      <div className="director-card w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 md:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white text-sm"
        >
          Close
        </button>

        <div className="uppercase tracking-[3px] text-xs text-[var(--gold)] mb-2">
          FREE FIRST CUT · NO CARD
        </div>
        <div className="font-display text-3xl md:text-4xl tracking-tight mb-2">
          {step === 'done_offer' ? 'Your sample journey' : 'Direct a free sample'}
        </div>
        <p className="text-white/55 text-sm mb-6 max-w-lg">
          {step === 'done_offer'
            ? FIRST_CUT_JOURNEY_COPY.afterSample
            : FIRST_CUT_JOURNEY_COPY.heroSub}
        </p>

        {step === 'path' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {paths.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  if (!token) {
                    onAuthRequired();
                    return;
                  }
                  setSelected(p);
                  setAnswers({});
                  setStep('answers');
                }}
                className="text-left p-4 rounded-2xl border border-white/10 bg-black/40 hover:border-[var(--gold)]/50 transition"
              >
                <div className="text-[10px] tracking-widest text-[var(--gold)] mb-1">{p.eyebrow}</div>
                <div className="font-display text-xl mb-1">{p.label}</div>
                <div className="text-xs text-white/55">{p.promise}</div>
                <div className="text-[10px] text-white/35 mt-2">{p.sampleOutcome}</div>
              </button>
            ))}
          </div>
        )}

        {step === 'answers' && selected && (
          <div>
            <button
              onClick={() => setStep('path')}
              className="text-xs text-white/50 mb-4 underline"
            >
              ← Change type
            </button>
            <div className="font-display text-2xl mb-1">{selected.label}</div>
            <div className="text-xs text-white/50 mb-5">{selected.sampleOutcome}</div>
            <div className="space-y-3">
              {selected.prompts.map((p) => (
                <div key={p.key}>
                  <label className="text-xs text-white/50 block mb-1">
                    {p.label}
                    {p.required ? ' *' : ''}
                  </label>
                  <input
                    className="w-full p-3 rounded-xl bg-black border border-white/10 text-sm"
                    placeholder={p.placeholder}
                    value={answers[p.key] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [p.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={createSample}
                className="btn-gold px-8 py-3 rounded-2xl text-black text-sm disabled:opacity-40"
              >
                {busy ? 'Building…' : 'Build my free sample project'}
              </button>
              <button onClick={onClose} className="btn-ghost px-4 py-3 text-sm text-white/50">
                Later
              </button>
            </div>
            <p className="text-[11px] text-white/35 mt-4">
              Includes 3 free frames + 2 free Grok video clips. Pre-production (shots, cast, style)
              stays free forever.
            </p>
          </div>
        )}

        {step === 'building' && (
          <div className="py-12 text-center text-white/50">
            Assembling your treatment + shot list…
          </div>
        )}

        {step === 'done_offer' && (
          <div>
            <div className="p-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 mb-6 text-sm">
              <div className="text-[var(--gold)] font-medium mb-1">Recommended next step</div>
              <p className="text-white/70">{FIRST_CUT_JOURNEY_COPY.trialPitch}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled={!!trialBusy || userState?.hasUsedTrial}
                onClick={() => startTrial('platform')}
                className="btn-gold px-6 py-3 rounded-2xl text-black text-sm disabled:opacity-40"
              >
                {trialBusy === 'platform'
                  ? 'Starting…'
                  : userState?.hasUsedTrial
                    ? 'Trial already used'
                    : 'Start 7-day free trial (no card)'}
              </button>
              <button
                disabled={!!trialBusy}
                onClick={() => startTrial('stripe')}
                className="btn-outline px-6 py-3 rounded-2xl text-sm disabled:opacity-40"
              >
                {trialBusy === 'stripe' ? 'Redirecting…' : 'Trial with Stripe (card, $0 today)'}
              </button>
              <button onClick={onOpenBilling} className="btn-ghost px-4 py-3 text-sm">
                See paid plans
              </button>
            </div>
            <p className="text-[11px] text-white/35 mt-4">
              Free forever: plan projects, edit treatments, use the feed & Social Studio. Generation
              beyond First Cut needs trial or paid credits.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
