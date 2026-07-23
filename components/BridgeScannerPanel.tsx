'use client';

/**
 * Bridge Scanner UI — scan A + B (media, script, cast, set) → brief → still → motion.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project, Shot } from '@/lib/types';
import {
  type BridgeScanBrief,
  findShotPair,
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
  const [afterId, setAfterId] = useState(storyShots[0]?.id || '');
  const [brief, setBrief] = useState<BridgeScanBrief | null>(null);
  const [busy, setBusy] = useState<'scan' | 'still' | 'motion' | null>(null);
  const [bridgeShotId, setBridgeShotId] = useState<string | null>(null);
  const [stillUrl, setStillUrl] = useState<string | null>(null);

  function runScan() {
    const pair = findShotPair(project.shots || [], afterId);
    if (!pair) {
      toast.error('Pick a shot that has a following story shot');
      return;
    }
    setBusy('scan');
    try {
      const b = scanBridgePair(project, pair.from, pair.to);
      setBrief(b);
      // Insert / replace bridge shot with scan baked in
      onUpdate((p) => {
        const nextShots = insertScannedBridge(p.shots || [], pair.fromIndex, b);
        const bridge = nextShots.find(
          (s) =>
            isTransitionShot(s) &&
            s.bridgeFromShotId === pair.from.id &&
            s.bridgeToShotId === pair.to.id
        );
        if (bridge) setBridgeShotId(bridge.id);
        return { ...p, shots: nextShots };
      });
      setStillUrl(null);
      toast.success('Bridge scanned', {
        description: b.canGenerateStill
          ? `Cast: ${b.castNames.join(', ') || 'none'} · Set: ${b.environmentName || 'from frames'} · ${b.referenceImageUrls.length} ref(s)${b.warnings?.length ? ' · ' + b.warnings[0] : ''}`
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
      toast.error('Run Scan first');
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
        Need at least two story shots to scan a bridge.
      </div>
    );
  }

  return (
    <div className="director-card p-5 rounded-3xl space-y-4 max-w-3xl">
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Bridge Scanner
        </div>
        <div className="font-display text-2xl tracking-tight">Scan → brief → still → motion</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Reads both shots (frames and/or clips), script/dialogue, cast locks, and environments — then
          generates a continuity bridge that cannot invent a third world.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[10px] text-white/40 mb-1 uppercase">Bridge after shot</div>
          <select
            className="director-input w-full p-2 text-sm rounded-xl bg-black"
            value={afterId}
            onChange={(e) => {
              setAfterId(e.target.value);
              setBrief(null);
              setStillUrl(null);
            }}
          >
            {storyShots.slice(0, -1).map((s) => (
              <option key={s.id} value={s.id}>
                #{s.number} — {(s.description || '').slice(0, 48)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={!!busy}
          className="btn-gold text-black text-sm px-5 py-2.5 rounded-2xl disabled:opacity-40"
        >
          {busy === 'scan' ? 'Scanning…' : '1 · Scan both shots'}
        </button>
      </div>

      {brief && (
        <div className="space-y-3 p-4 rounded-2xl border border-white/10 bg-black/50">
          <div className="text-[10px] tracking-widest uppercase text-white/40">Continuity brief (free)</div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-white/40">FROM #{brief.from.number}</div>
              <div className="text-white/80 line-clamp-3">{brief.from.description}</div>
              <div className="text-white/40 mt-1">Media: {brief.from.media}</div>
            </div>
            <div>
              <div className="text-white/40">TO #{brief.to.number}</div>
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
