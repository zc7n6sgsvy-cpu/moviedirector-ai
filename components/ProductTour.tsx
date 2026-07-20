'use client';

import React from 'react';
import { PRODUCT_TOUR_STEPS, type TourStep } from '@/lib/product-tour';

type Props = {
  open: boolean;
  stepIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
};

export default function ProductTour({
  open,
  stepIndex,
  onClose,
  onNext,
  onPrev,
  onGoTo,
}: Props) {
  if (!open) return null;

  const step: TourStep = PRODUCT_TOUR_STEPS[stepIndex] || PRODUCT_TOUR_STEPS[0];
  const total = PRODUCT_TOUR_STEPS.length;
  const isLast = stepIndex >= total - 1;
  const progress = Math.round(((stepIndex + 1) / total) * 100);

  // Chapter dots
  const chapters = Array.from(new Set(PRODUCT_TOUR_STEPS.map((s) => s.chapter)));

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Dim top/bottom, leave center readable */}
      <div className="absolute inset-0 bg-black/55 pointer-events-auto" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto director-card rounded-3xl border border-[var(--gold)]/40 shadow-2xl overflow-hidden">
          {/* Progress */}
          <div className="h-1 bg-white/10">
            <div
              className="h-full bg-[var(--gold)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)]">
                  Product tour · {step.chapter}
                </div>
                <div className="font-display text-2xl md:text-3xl tracking-tight mt-1">
                  {step.title}
                </div>
              </div>
              <div className="text-xs text-white/40 font-mono">
                {stepIndex + 1} / {total}
              </div>
            </div>

            <p className="text-sm md:text-[15px] text-white/70 leading-relaxed mb-4">
              {step.body}
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-5">
              {step.navHint && (
                <span className="text-[10px] px-3 py-1 rounded-full border border-white/15 text-white/50">
                  Looking at: {step.navHint}
                </span>
              )}
              {step.tab && (
                <span className="text-[10px] px-3 py-1 rounded-full border border-[var(--gold)]/30 text-[var(--gold)]">
                  Tab: {step.tab}
                </span>
              )}
            </div>

            {/* Mini chapter map */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {chapters.map((ch) => {
                const firstIdx = PRODUCT_TOUR_STEPS.findIndex((s) => s.chapter === ch);
                const active = step.chapter === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => onGoTo(firstIdx)}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition ${
                      active
                        ? 'bg-[var(--gold)] text-black'
                        : 'bg-white/5 text-white/45 hover:text-white/70'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-white/45 hover:text-white/80 px-2"
              >
                Exit tour
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={stepIndex === 0}
                  className="btn-outline px-5 py-2 rounded-2xl text-sm disabled:opacity-30"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={isLast ? onClose : onNext}
                  className="btn-gold px-6 py-2 rounded-2xl text-sm text-black"
                >
                  {isLast ? 'Finish tour' : 'Next feature →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
