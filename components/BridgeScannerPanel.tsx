'use client';

/**
 * Bridge Scanner — pick two shots (A + B), scan media/script/cast/set, then still → motion.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import {
  type BridgeScanBrief,
  findShotPairByIds,
  insertScannedBridge,
  scanBridgePair,
} from '@/lib/bridge-scanner';
import { isTransitionShot } from '@/lib/transitions';

type Props = {
  project: Project;
  token: string | null;
  genQuality: 'draft' | 'final';
  onUpdate: (updater: (p: Project) => Project) => void;
  onCreditBalance?: (n: number) => void;
  onAuthRequired?: () => void;
};

function shotLabel(s: { number: number; description?: string; imageUrl?: string; videoUrl?: string }) {
  const media = s.videoUrl ? 'clip' : s.imageUrl ? 'frame' : 'empty';
  const d = (s.description || 'Untitled').slice(0, 40);
  return `#${s.number} [${media}] ${d}${(s.description || '').length > 40 ? '…' : ''}`;
}

export default function BridgeScannerPanel({
  project,
  token,
  genQuality,
  onUpdate,
  onCreditBalance,
  onAuthRequired,
}: Props) {
  const storyShots = useMemo(
    () => (project.shots || []).filter((s) => !isTransitionShot(s)),
    [project.shots]
  );

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [brief, setBrief] = useState<BridgeScanBrief | null>(null);
  const [busy, setBusy] = useState<'scan' | 'still' | 'motion' | null>(null);
  const [bridgeShotId, setBridgeShotId] = useState<string | null>(null);
  const [stillUrl, setStillUrl] = useState<string | null>(null);

  // Default: first two story shots
  useEffect(() => {
    if (!storyShots.length) return;
    if (!fromId || !storyShots.some((s) => s.id === fromId)) {
      setFromId(storyShots[0].id);
    }
    if (!toId || !storyShots.some((s) => s.id === toId)) {
      const second = storyShots[1]?.id || storyShots[0].id;
      setToId(second);
    }
  }, [storyShots, fromId, toId]);

  const fromShot = storyShots.find((s) => s.id === fromId);
  const toShot = storyShots.find((s) => s.id === toId);

  function runScan() {
    if (fromId === toId) {
      toast.error('Pick two different shots — Shot A and Shot B');
      return;
    }
    const pair = findShotPairByIds(project.shots || [], fromId, toId);
    if (!pair) {
      toast.error('Could not resolve those shots');
      return;
    }
    setBusy('scan');
    try {
      const b = scanBridgePair(project, pair.from, pair.to);
      setBrief(b);
      onUpdate((p) => {
        const nextShots = insertScannedBridge(p.shots || [], fromId, toId, b);
        const bridge = nextShots.find(
          (s) =>
            isTransitionShot(s) &&
            s.bridgeFromShotId === fromId &&
            s.bridgeToShotId === toId
        );
        if (bridge) setBridgeShotId(bridge.id);
        return { ...p, shots: nextShots };
      });
      setStillUrl(null);
      toast.success(`Scanned #${pair.from.number} → #${pair.to.number}`, {
        description: b.canGenerateStill
          ? `Cast: ${b.castNames.join(', ') || 'none'} · Set: ${b.environmentName || 'from frames'} · ${b.referenceImageUrls.length} ref(s)`
          : b.stillBlocker,
      });
      if (b.warnings?.length) {
        toast.message('Scanner notes', { description: b.warnings.join(' ') });
      }
    } finally {
      setBusy(null);
    }
  }

  async function genStill() {
    if (!brief) {
      toast.error('Select two shots and run Scan first');
      return;
    }
    if (!brief.canGenerateStill) {
      toast.error('Scan incomplete', { description: brief.stillBlocker });
      return;
    }
    if (!token) {
      onAuthRequired?.();
      return;
    }
    setBusy('still');
    try {
      const res = await fetch('/api/generate/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: project.id,
          stage: 'still',
          quality: genQuality,
          brief,
          shotId: bridgeShotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bridge still failed');
      setStillUrl(data.imageUrl);
      if (bridgeShotId) {
        onUpdate((p) => ({
          ...p,
          shots: (p.shots || []).map((s) =>
            s.id === bridgeShotId ? { ...s, imageUrl: data.imageUrl as string } : s
          ),
        }));
      }
      if (typeof data.creditBalance === 'number') onCreditBalance?.(data.creditBalance);
      toast.success(`Bridge still via image-edit (${data.editMode || 'edit'}) −${data.creditsCharged || 0} cr`, {
        description: `Cast: ${(data.briefSummary?.cast || []).join(', ') || '—'} · Set: ${data.briefSummary?.environment || 'frames'} · ${data.briefSummary?.refs || 0} refs`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bridge still failed');
    } finally {
      setBusy(null);
    }
  }

  async function genMotion() {
    if (!brief || !stillUrl) {
      toast.error('Generate bridge still first');
      return;
    }
    if (!token) {
      onAuthRequired?.();
      return;
    }
    setBusy('motion');
    try {
      const res = await fetch('/api/generate/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: project.id,
          stage: 'motion',
          quality: genQuality,
          brief,
          seedImageUrl: stillUrl,
          shotId: bridgeShotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bridge motion failed');
      if (bridgeShotId) {
        onUpdate((p) => ({
          ...p,
          shots: (p.shots || []).map((s) =>
            s.id === bridgeShotId
              ? { ...s, videoUrl: data.videoUrl as string, imageUrl: stillUrl || s.imageUrl }
              : s
          ),
        }));
      }
      if (typeof data.creditBalance === 'number') onCreditBalance?.(data.creditBalance);
      toast.success(`Bridge clip ready (−${data.creditsCharged || 0} cr)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bridge motion failed');
    } finally {
      setBusy(null);
    }
  }

  if (storyShots.length < 2) {
    return (
      <div className="p-4 rounded-2xl border border-white/10 text-sm text-white/50">
        Need at least two story shots to scan a bridge. Add shots and generate frames on both first.
      </div>
    );
  }

  return (
    <div className="director-card p-5 rounded-3xl space-y-4 max-w-3xl">
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Bridge Scanner
        </div>
        <div className="font-display text-2xl tracking-tight">Pick two shots → scan → still → motion</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Choose <strong className="text-white/70">Shot A</strong> (outgoing) and{' '}
          <strong className="text-white/70">Shot B</strong> (incoming). The scanner reads both frames/clips,
          script, cast, and set — then builds a continuity bridge between them.
        </p>
      </div>

      {/* Two explicit shot pickers */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-[var(--gold)] mb-1 uppercase tracking-wider">
            Shot A · from (outgoing)
          </div>
          <select
            className="director-input w-full p-2.5 text-sm rounded-xl bg-black border border-[var(--gold)]/30"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value);
              setBrief(null);
              setStillUrl(null);
            }}
          >
            {storyShots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === toId}>
                {shotLabel(s)}
              </option>
            ))}
          </select>
          {fromShot?.imageUrl && (
            <img
              src={fromShot.imageUrl}
              alt={`Shot ${fromShot.number}`}
              className="mt-2 h-20 w-full object-cover rounded-lg border border-white/10"
            />
          )}
          {!fromShot?.imageUrl && (
            <div className="mt-2 text-[10px] text-amber-300/80">No frame yet on A — generate one first</div>
          )}
        </div>
        <div>
          <div className="text-[10px] text-[var(--cyan)] mb-1 uppercase tracking-wider">
            Shot B · to (incoming)
          </div>
          <select
            className="director-input w-full p-2.5 text-sm rounded-xl bg-black border border-[var(--cyan)]/30"
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setBrief(null);
              setStillUrl(null);
            }}
          >
            {storyShots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === fromId}>
                {shotLabel(s)}
              </option>
            ))}
          </select>
          {toShot?.imageUrl && (
            <img
              src={toShot.imageUrl}
              alt={`Shot ${toShot.number}`}
              className="mt-2 h-20 w-full object-cover rounded-lg border border-white/10"
            />
          )}
          {!toShot?.imageUrl && (
            <div className="mt-2 text-[10px] text-amber-300/80">No frame yet on B — generate one first</div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={runScan}
        disabled={!!busy || fromId === toId}
        className="btn-gold text-black text-sm px-5 py-2.5 rounded-2xl disabled:opacity-40 w-full sm:w-auto"
      >
        {busy === 'scan' ? 'Scanning…' : '1 · Scan selected shots'}
      </button>

      {brief && (
        <div className="space-y-3 p-4 rounded-2xl border border-white/10 bg-black/50">
          <div className="text-[10px] tracking-widest uppercase text-white/40">
            Continuity brief · #{brief.from.number} → #{brief.to.number} (free)
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded-xl bg-black/40 border border-[var(--gold)]/20">
              <div className="text-[var(--gold)]/80 text-[10px] uppercase mb-1">Shot A · #{brief.from.number}</div>
              <div className="text-white/80 line-clamp-3">{brief.from.description}</div>
              <div className="text-white/40 mt-1">Media: {brief.from.media}</div>
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-[var(--cyan)]/20">
              <div className="text-[var(--cyan)]/80 text-[10px] uppercase mb-1">Shot B · #{brief.to.number}</div>
              <div className="text-white/80 line-clamp-3">{brief.to.description}</div>
              <div className="text-white/40 mt-1">Media: {brief.to.media}</div>
            </div>
          </div>
          <div className="text-xs text-white/70">
            <span className="text-white/40">Cast: </span>
            {brief.castNames.length ? brief.castNames.join(', ') : 'none tagged'}
            {' · '}
            <span className="text-white/40">Set: </span>
            {brief.environmentName || 'from frames'}
            {' · '}
            <span className="text-white/40">Refs: </span>
            {brief.referenceImageUrls.length} image(s)
          </div>
          {brief.scriptLines.length > 0 && (
            <div className="text-[11px] text-white/55 font-mono whitespace-pre-wrap line-clamp-4">
              {brief.scriptLines.join('\n')}
            </div>
          )}
          {!brief.canGenerateStill && (
            <div className="text-xs text-amber-300/90 border border-amber-400/30 rounded-xl px-3 py-2">
              {brief.stillBlocker}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={genStill}
              disabled={!!busy || !brief.canGenerateStill}
              className="btn-outline text-sm px-4 py-2 rounded-xl disabled:opacity-40"
            >
              {busy === 'still' ? 'Editing still…' : '2 · Generate bridge still'}
            </button>
            <button
              type="button"
              onClick={genMotion}
              disabled={!!busy || !stillUrl}
              className="btn-gold text-black text-sm px-4 py-2 rounded-xl disabled:opacity-40"
            >
              {busy === 'motion' ? 'Animating…' : '3 · Animate bridge'}
            </button>
          </div>
          {stillUrl && (
            <img src={stillUrl} alt="Bridge still" className="max-h-40 rounded-xl border border-white/10" />
          )}
        </div>
      )}
    </div>
  );
}
