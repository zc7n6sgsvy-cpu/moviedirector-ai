'use client';

/**
 * Narrative Engine UI — showrunner proposes; director accepts.
 * Homes: Concept Lab station + Shot List range.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import {
  EMOTIONAL_TARGETS,
  NARRATIVE_GENRES,
  NARRATIVE_MODES,
  applyNarrativeVersion,
  projectTypeToGenreHint,
  type EmotionalTarget,
  type NarrativeEngineResult,
  type NarrativeGenre,
  type NarrativeMode,
  type NarrativeVersion,
} from '@/lib/narrative-engine';
import { isTransitionShot } from '@/lib/transitions';

type Props = {
  project: Project;
  token: string | null;
  onUpdate: (updater: (p: Project) => Project) => void;
  onCreditBalance?: (n: number) => void;
  onAuthRequired?: () => void;
  /** Pre-selected shot numbers (Shot List range mode) */
  initialShotNumbers?: number[];
  /** Compact for embedding in shot list */
  compact?: boolean;
  onGoStoryboard?: () => void;
};

export default function NarrativeEnginePanel({
  project,
  token,
  onUpdate,
  onCreditBalance,
  onAuthRequired,
  initialShotNumbers,
  compact,
  onGoStoryboard,
}: Props) {
  const storyShots = useMemo(
    () => (project.shots || []).filter((s) => !isTransitionShot(s)),
    [project.shots]
  );

  const [mode, setMode] = useState<NarrativeMode>(
    initialShotNumbers?.length ? 'selected-range' : 'amplify'
  );
  const [genre, setGenre] = useState<NarrativeGenre>(
    projectTypeToGenreHint(project.type)
  );
  const [targets, setTargets] = useState<EmotionalTarget[]>([
    'obsession-next-episode',
    'raise-stakes',
  ]);
  const [shotNums, setShotNums] = useState<number[]>(initialShotNumbers || []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NarrativeEngineResult | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [applyScript, setApplyScript] = useState(true);
  const [applyShots, setApplyShots] = useState(true);
  const [applyLogline, setApplyLogline] = useState(false);

  function toggleTarget(id: EmotionalTarget) {
    setTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleShot(n: number) {
    setShotNums((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  }

  async function runEngine() {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    if (mode === 'selected-range' && !shotNums.length) {
      toast.error('Select one or more shots for Selected Range mode');
      return;
    }
    if (!targets.length) {
      toast.error('Pick at least one emotional target');
      return;
    }

    setBusy(true);
    setResult(null);
    setSelectedVersionId(null);
    try {
      const res = await fetch('/api/generate/narrative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: project.id,
          mode,
          genre,
          targets,
          selectedShotNumbers: mode === 'selected-range' ? shotNums : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Narrative engine failed');
      const r = data.result as NarrativeEngineResult;
      setResult(r);
      if (r.versions[0]) setSelectedVersionId(r.versions[0].id);
      if (typeof data.creditBalance === 'number') onCreditBalance?.(data.creditBalance);
      toast.success(`${r.versions.length} narrative version(s) ready (−${data.creditsCharged ?? 2} cr)`, {
        description: r.directorNotes || 'Preview, then accept the one you want.',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Narrative engine failed');
    } finally {
      setBusy(false);
    }
  }

  function acceptVersion(v: NarrativeVersion) {
    onUpdate((p) =>
      applyNarrativeVersion(p, v, {
        writeScript: applyScript,
        writeShots: applyShots,
        writeLogline: applyLogline,
      })
    );
    toast.success(`Accepted: ${v.title}`, {
      description: 'Script / shots updated. You can refine in Lab or generate frames next.',
    });
    onGoStoryboard?.();
  }

  const selected = result?.versions.find((v) => v.id === selectedVersionId) || null;

  return (
    <div
      className={`director-card p-5 rounded-3xl space-y-5 ${compact ? 'max-w-full' : 'max-w-3xl'}`}
    >
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Narrative Engine · showrunner + twist specialist
        </div>
        <div className="font-display text-2xl tracking-tight">Elevate the story</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Turn ordinary beats into addictive, high-stakes narrative. Genre-correct tension and
          earned plot twists. The engine proposes — you decide.
        </p>
      </div>

      {/* Mode */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">1 · Scope</div>
        <div className="flex flex-wrap gap-1.5">
          {NARRATIVE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.purpose}
              onClick={() => setMode(m.id)}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border ${
                mode === m.id
                  ? 'border-[var(--gold)] bg-[var(--gold)]/20 text-white'
                  : 'border-white/15 text-white/50 hover:border-white/30'
              }`}
            >
              {m.short}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1.5">
          {NARRATIVE_MODES.find((m) => m.id === mode)?.purpose}
        </p>
      </div>

      {/* Genre */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">2 · Genre grammar</div>
        <select
          className="director-input w-full p-2 text-sm rounded-xl bg-black"
          value={genre}
          onChange={(e) => setGenre(e.target.value as NarrativeGenre)}
        >
          {NARRATIVE_GENRES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {/* Targets */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
          3 · Emotional targets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONAL_TARGETS.map((t) => {
            const on = targets.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTarget(t.id)}
                className={`text-[10px] px-2.5 py-1.5 rounded-full border ${
                  on
                    ? 'border-[var(--cyan)]/60 bg-[var(--cyan)]/15 text-white'
                    : 'border-white/15 text-white/45'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shot range */}
      {(mode === 'selected-range' || mode === 'mid-hooks' || mode === 'beginning-hook' || mode === 'ending-cliffhanger') && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
            {mode === 'selected-range' ? 'Shots in range (required)' : 'Focus shots (optional)'}
          </div>
          <div className="flex flex-wrap gap-1">
            {storyShots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleShot(s.number)}
                className={`text-[10px] px-2 py-1 rounded-full border ${
                  shotNums.includes(s.number)
                    ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                    : 'border-white/15 text-white/45'
                }`}
              >
                #{s.number}
              </button>
            ))}
            {!storyShots.length && (
              <span className="text-[11px] text-white/40">No shots yet — full script/logline will be used.</span>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={runEngine}
        disabled={busy}
        className="btn-gold text-black text-sm px-5 py-2.5 rounded-xl disabled:opacity-40"
      >
        {busy ? 'Showrunner working…' : 'Generate narrative versions (−2 cr)'}
      </button>

      {result && (
        <div className="space-y-4 pt-3 border-t border-white/10">
          {result.directorNotes && (
            <p className="text-[11px] text-[var(--cyan)]/90 italic">{result.directorNotes}</p>
          )}
          <div className="text-[10px] text-white/40">
            Applied grammar: {result.genreApplied} · {result.versions.length} version(s)
          </div>

          <div className="grid gap-2">
            {result.versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVersionId(v.id)}
                className={`text-left p-3 rounded-xl border ${
                  selectedVersionId === v.id
                    ? 'border-[var(--gold)]/50 bg-[var(--gold)]/10'
                    : 'border-white/10 bg-black/40'
                }`}
              >
                <div className="font-display text-lg">{v.title}</div>
                {v.twistSummary && (
                  <div className="text-[11px] text-amber-200/90 mt-1">Twist: {v.twistSummary}</div>
                )}
                <div className="text-[11px] text-white/55 mt-1 line-clamp-2">{v.whyItWorks}</div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="p-4 rounded-2xl border border-white/10 bg-black/50 space-y-3">
              <div className="font-display text-xl">{selected.title}</div>
              {selected.emotionalArc && (
                <p className="text-xs text-white/60">Arc: {selected.emotionalArc}</p>
              )}
              {selected.twistSetup && (
                <div className="text-[11px] text-white/70 space-y-1">
                  <div>
                    <span className="text-white/40">Setup: </span>
                    {selected.twistSetup}
                  </div>
                  {selected.twistMisdirection && (
                    <div>
                      <span className="text-white/40">Misdirection: </span>
                      {selected.twistMisdirection}
                    </div>
                  )}
                  {selected.twistPayoff && (
                    <div>
                      <span className="text-white/40">Payoff: </span>
                      {selected.twistPayoff}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-[10px] uppercase text-white/40">Beat changes</div>
                {selected.beatChanges.map((b, i) => (
                  <div key={i} className="text-[11px] text-white/75 border-l-2 border-[var(--gold)]/40 pl-2">
                    <span className="text-white/45">{b.beatLabel}</span>
                    {b.isTwist && (
                      <span className="ml-1 text-[9px] uppercase text-amber-300">twist</span>
                    )}
                    <div>{b.after}</div>
                  </div>
                ))}
                {!selected.beatChanges.length && (
                  <div className="text-[11px] text-white/40">See script patch / shot updates below.</div>
                )}
              </div>
              {selected.scriptPatch && (
                <pre className="text-[10px] text-white/55 whitespace-pre-wrap max-h-32 overflow-y-auto bg-black/40 p-2 rounded-lg">
                  {selected.scriptPatch.slice(0, 1200)}
                  {selected.scriptPatch.length > 1200 ? '…' : ''}
                </pre>
              )}

              <div className="flex flex-wrap gap-3 text-[10px] text-white/50">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={applyScript}
                    onChange={(e) => setApplyScript(e.target.checked)}
                  />
                  Write script
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={applyShots}
                    onChange={(e) => setApplyShots(e.target.checked)}
                  />
                  Update / insert shots
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={applyLogline}
                    onChange={(e) => setApplyLogline(e.target.checked)}
                  />
                  Replace logline
                </label>
              </div>

              <button
                type="button"
                onClick={() => acceptVersion(selected)}
                className="btn-gold text-black text-sm px-5 py-2 rounded-xl"
              >
                Accept this version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
