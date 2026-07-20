'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import {
  AD_FORMATS,
  type AdFormatId,
  type BrandKit,
  applyMarketingPlanToProject,
  buildAdBeats,
  estimateAdCredits,
  getAdFormat,
} from '@/lib/marketing-studio';

type Props = {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
  onGoStoryboard: () => void;
  onGoClips: () => void;
  onGoLab: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export default function MarketingStudio({
  project,
  onUpdate,
  onGoStoryboard,
  onGoClips,
  onGoLab,
}: Props) {
  const [kit, setKit] = useState<BrandKit>({
    brandName: project.brandKit?.brandName || project.title,
    product: project.brandKit?.product || '',
    audience: project.brandKit?.audience || project.worldBible?.audience || '',
    offer: project.brandKit?.offer || '',
    cta: project.brandKit?.cta || 'Shop now',
    tone: project.brandKit?.tone || project.worldBible?.tone || 'sharp, modern',
    visualLaws: project.brandKit?.visualLaws || project.worldBible?.visualLaws || project.style?.description || '',
    never: project.brandKit?.never || project.worldBible?.whatNever || '',
    competitorsAvoid: project.brandKit?.competitorsAvoid || '',
    urlOrHandle: project.brandKit?.urlOrHandle || '',
  });
  const [formatId, setFormatId] = useState<AdFormatId>(
    (project.adFormatId as AdFormatId) || 'tiktok-15'
  );

  const format = getAdFormat(formatId);
  const beats = useMemo(() => buildAdBeats(kit, format), [kit, format]);
  const credits = estimateAdCredits(format.totalSec);

  function patchKit(p: Partial<BrandKit>) {
    setKit((k) => ({ ...k, ...p }));
  }

  function applyPlan() {
    if (!kit.product?.trim() && !kit.offer?.trim()) {
      toast.error('Add a product or offer — precision ads need a job to do.');
      return;
    }
    onUpdate((p) => applyMarketingPlanToProject(p, kit, formatId, uid));
    toast.success(`${format.label} plan locked`, {
      description: `${beats.length} timed beats · draft ≈ ${credits.draft} cr · final ≈ ${credits.final} cr if you burn the whole spot`,
    });
    onGoStoryboard();
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--cyan)] mb-1">
          Marketing Studio · Short-form / ads
        </div>
        <div className="font-display text-4xl sm:text-5xl tracking-tight">Brand desk, not random clips</div>
        <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
          Higgs/Kling sell model buffets. Here every second has a job: hook, product, offer, CTA — with the
          same cast, style DNA, and spend controls as a sitcom pilot. Plan free. Draft cheap. Final when
          the spot is locked.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="space-y-3">
          <Field label="Brand name">
            <input
              className="lab-input"
              value={kit.brandName || ''}
              onChange={(e) => patchKit({ brandName: e.target.value })}
              placeholder="Acme / your personal brand"
            />
          </Field>
          <Field label="Product / hero">
            <input
              className="lab-input"
              value={kit.product || ''}
              onChange={(e) => patchKit({ product: e.target.value })}
              placeholder="What are we selling or launching?"
            />
          </Field>
          <Field label="Audience">
            <input
              className="lab-input"
              value={kit.audience || ''}
              onChange={(e) => patchKit({ audience: e.target.value })}
              placeholder="Who must feel seen in 2 seconds?"
            />
          </Field>
          <Field label="Offer">
            <input
              className="lab-input"
              value={kit.offer || ''}
              onChange={(e) => patchKit({ offer: e.target.value })}
              placeholder="30% off · free trial · waitlist"
            />
          </Field>
          <Field label="CTA">
            <input
              className="lab-input"
              value={kit.cta || ''}
              onChange={(e) => patchKit({ cta: e.target.value })}
              placeholder="Shop now · Link in bio · Book demo"
            />
          </Field>
        </div>
        <div className="space-y-3">
          <Field label="Tone">
            <input
              className="lab-input"
              value={kit.tone || ''}
              onChange={(e) => patchKit({ tone: e.target.value })}
              placeholder="Deadpan · premium calm · chaotic founder"
            />
          </Field>
          <Field label="Visual laws">
            <textarea
              className="lab-input min-h-[70px]"
              value={kit.visualLaws || ''}
              onChange={(e) => patchKit({ visualLaws: e.target.value })}
              placeholder="Always matte black product, no stock office, 2D cel, etc."
            />
          </Field>
          <Field label="Never on camera">
            <input
              className="lab-input"
              value={kit.never || ''}
              onChange={(e) => patchKit({ never: e.target.value })}
              placeholder="No fake celebrities · no medical claims"
            />
          </Field>
          <Field label="Handle / URL energy">
            <input
              className="lab-input"
              value={kit.urlOrHandle || ''}
              onChange={(e) => patchKit({ urlOrHandle: e.target.value })}
              placeholder="@brand · brand.com"
            />
          </Field>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[10px] tracking-widest uppercase text-white/40 mb-2">Format</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {AD_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormatId(f.id)}
              className={`text-left p-3 rounded-2xl border transition ${
                formatId === f.id
                  ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-[10px] text-white/45 mt-0.5">
                {f.platform} · {f.aspectRatio} · {f.beatCount} beats
              </div>
              <div className="text-[11px] text-white/55 mt-1">{f.purpose}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="director-card p-5 rounded-3xl mb-6">
        <div className="flex flex-wrap justify-between gap-2 mb-3">
          <div className="text-[10px] tracking-widest uppercase text-[var(--gold)]">Timed beat sheet</div>
          <div className="text-xs text-white/50 font-mono">
            {format.totalSec}s · draft ~{credits.draft} cr · final ~{credits.final} cr
          </div>
        </div>
        <div className="space-y-2">
          {beats.map((b, i) => (
            <div
              key={b.title + i}
              className="flex gap-3 p-3 rounded-xl bg-black/40 border border-white/5 text-sm"
            >
              <div className="font-mono text-[10px] text-[var(--cyan)] w-16 shrink-0">
                {b.seconds}s
                <div className="text-white/40 mt-0.5">{b.title}</div>
              </div>
              <div>
                <div className="text-white/90">{b.job}</div>
                <div className="text-xs text-white/45 mt-0.5 line-clamp-2">{b.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={applyPlan} className="btn-gold text-black px-6 py-2.5 rounded-2xl text-sm">
          Lock plan → shot list
        </button>
        <button type="button" onClick={onGoLab} className="btn-outline px-5 py-2.5 rounded-2xl text-sm">
          Open full Lab
        </button>
        <button type="button" onClick={onGoClips} className="btn-outline px-5 py-2.5 rounded-2xl text-sm">
          Generate clips
        </button>
      </div>
      <p className="text-[11px] text-white/40 mt-4 max-w-xl">
        Precision edge: one job per beat, brand “never” list, cast from Ensemble, draft first. Same $20
        that buys random Seedance clips elsewhere can fund a full short pilot or several locked ads here.
      </p>

      <style jsx>{`
        :global(.lab-input) {
          width: 100%;
          padding: 0.65rem 0.9rem;
          border-radius: 0.75rem;
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 0.9rem;
        }
        :global(.lab-input:focus) {
          outline: none;
          border-color: rgba(197, 164, 110, 0.5);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-white/45 mb-1 uppercase">{label}</div>
      {children}
    </div>
  );
}
