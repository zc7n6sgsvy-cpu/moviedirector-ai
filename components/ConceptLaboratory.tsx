'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Character, ContinuityNotes, Project, WorldBible } from '@/lib/types';
import {
  LAB_STATIONS,
  labReadiness,
  applyScriptToShots,
  emptyWorldBible,
  emptyContinuity,
  type LabStationId,
} from '@/lib/concept-lab';
import NarrativeEnginePanel from '@/components/NarrativeEnginePanel';

type Props = {
  project: Project;
  token?: string | null;
  onUpdate: (updater: (p: Project) => Project) => void;
  onGoStoryboard: () => void;
  onGoEnsemble: () => void;
  onGoClips: () => void;
  /** One-click: treatment + shot list from title/logline (minimal mode) */
  onRunAutoBuild: () => void;
  onCreditBalance?: (n: number) => void;
  onAuthRequired?: () => void;
};

export default function ConceptLaboratory({
  project,
  token,
  onUpdate,
  onGoStoryboard,
  onGoEnsemble,
  onGoClips,
  onRunAutoBuild,
  onCreditBalance,
  onAuthRequired,
}: Props) {
  const mode = project.generationSettings?.workflowMode || 'lab';
  const [station, setStation] = useState<LabStationId>(mode === 'auto' ? 'auto' : 'world');
  const world: WorldBible = { ...emptyWorldBible(), ...project.worldBible };
  const continuity: ContinuityNotes = { ...emptyContinuity(), ...project.continuity };
  const cast = project.characters || [];
  const readiness = useMemo(() => labReadiness(project), [project]);
  const mediaCount = (project.shots || []).filter((s) => s.imageUrl || s.videoUrl).length;

  function setMode(workflowMode: 'auto' | 'lab') {
    onUpdate((p) => ({
      ...p,
      generationSettings: { ...p.generationSettings, workflowMode },
    }));
    setStation(workflowMode === 'auto' ? 'auto' : 'world');
  }

  function setWorld(patch: Partial<WorldBible>) {
    onUpdate((p) => ({
      ...p,
      worldBible: { ...emptyWorldBible(), ...p.worldBible, ...patch },
    }));
  }

  function setContinuity(patch: Partial<ContinuityNotes>) {
    onUpdate((p) => ({
      ...p,
      continuity: { ...emptyContinuity(), ...p.continuity, ...patch },
    }));
  }

  function setScript(script: string) {
    onUpdate((p) => ({ ...p, script }));
  }

  function updateChar(id: string, patch: Partial<Character>) {
    onUpdate((p) => ({
      ...p,
      characters: (p.characters || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function pushScriptToShots() {
    if (!project.script?.trim()) {
      toast.error('Write a script first in Script Control');
      return;
    }
    onUpdate((p) => ({
      ...p,
      shots: applyScriptToShots(p.shots || [], p.script || ''),
    }));
    toast.success('Script dialogue pushed onto shots', {
      description: 'Open Storyboard to refine acting, camera, and blocking.',
    });
    onGoStoryboard();
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
            PRE-PRODUCTION · CONCEPT LABORATORY
          </div>
          <div className="font-display text-4xl sm:text-5xl tracking-tight">The Lab</div>
          <p className="text-sm text-white/55 mt-2 max-w-2xl">
            Plan free. Generate when ready. Use <strong className="text-white/80">Auto</strong> for
            minimal input, or walk the stations for full director control.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/40 uppercase tracking-widest">Lab readiness</div>
          <div
            className={`font-mono text-3xl ${
              readiness.score >= 70
                ? 'text-emerald-400'
                : readiness.score >= 40
                  ? 'text-[var(--gold)]'
                  : 'text-white/50'
            }`}
          >
            {readiness.score}%
          </div>
        </div>
      </div>

      {/* Mode toggle — Auto vs full Lab */}
      <div className="mb-6 p-1 rounded-2xl border border-white/10 bg-black/40 inline-flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setMode('auto')}
          className={`px-4 py-2 rounded-xl text-sm transition ${
            mode === 'auto' ? 'bg-[var(--gold)] text-black' : 'text-white/60 hover:text-white'
          }`}
        >
          Auto · minimal input
        </button>
        <button
          type="button"
          onClick={() => setMode('lab')}
          className={`px-4 py-2 rounded-xl text-sm transition ${
            mode === 'lab' ? 'bg-[var(--gold)] text-black' : 'text-white/60 hover:text-white'
          }`}
        >
          Lab · full control
        </button>
      </div>

      {/* Station nav — hide deep stations in auto mode */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(mode === 'auto' ? LAB_STATIONS.filter((s) => s.id === 'auto' || s.id === 'readiness' || s.id === 'economy') : LAB_STATIONS).map(
          (s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStation(s.id)}
              className={`px-3 py-2 rounded-full text-xs sm:text-sm transition ${
                station === s.id
                  ? 'bg-[var(--gold)] text-black'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              {s.short}
            </button>
          )
        )}
      </div>

      <div className="mb-4 text-xs text-white/45">
        {LAB_STATIONS.find((s) => s.id === station)?.purpose}
      </div>

      {/* AUTO / MINIMAL */}
      {station === 'auto' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 text-sm text-white/70 leading-relaxed">
            <strong className="text-[var(--gold)]">Auto mode</strong> is the fast path: title +
            logline (and optional concept) → we build a treatment synopsis and a full shot list for
            you. You can still open Lab stations anytime for script, prompts, and direction.
            <br />
            <span className="text-white/50">
              Not the same as Berserker — Berserker only turns creative intensity up. Auto is about
              less typing.
            </span>
          </div>
          <Field label="Title">
            <input
              className="lab-input"
              value={project.title}
              onChange={(e) => onUpdate((p) => ({ ...p, title: e.target.value }))}
              placeholder="Project title"
            />
          </Field>
          <Field label="Logline (required — one sentence)">
            <textarea
              className="lab-input min-h-[80px]"
              value={project.logline}
              onChange={(e) => onUpdate((p) => ({ ...p, logline: e.target.value }))}
              placeholder="What is this film in one sharp sentence?"
            />
          </Field>
          <Field label="Concept (optional — Auto can invent from logline)">
            <textarea
              className="lab-input min-h-[80px]"
              value={project.concept || ''}
              onChange={(e) => onUpdate((p) => ({ ...p, concept: e.target.value }))}
              placeholder="Optional high-level vision…"
            />
          </Field>
          {mediaCount > 0 && (
            <div className="text-xs text-amber-300/90 border border-amber-400/30 rounded-xl px-3 py-2">
              You already have {mediaCount} frame/clip(s). Auto rebuild keeps them on matching shot
              numbers when possible — and will ask before replacing the shot list.
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRunAutoBuild}
              className="btn-gold text-black text-sm px-6 py-3 rounded-2xl"
            >
              Build treatment + shot list for me
            </button>
            <button type="button" onClick={onGoStoryboard} className="btn-outline text-sm px-5 py-3 rounded-2xl">
              Open shot list
            </button>
            <button
              type="button"
              onClick={() => setMode('lab')}
              className="btn-outline text-sm px-5 py-3 rounded-2xl"
            >
              Switch to full Lab
            </button>
          </div>
        </div>
      )}

      {/* WORLD */}
      {station === 'world' && (
        <div className="space-y-4">
          <Field label="Logline (one sentence)">
            <textarea
              className="lab-input min-h-[70px]"
              value={project.logline}
              onChange={(e) => onUpdate((p) => ({ ...p, logline: e.target.value }))}
              placeholder="What is this film in one sharp sentence?"
            />
          </Field>
          <Field label="High-level concept / pitch">
            <textarea
              className="lab-input min-h-[90px]"
              value={project.concept || ''}
              onChange={(e) => onUpdate((p) => ({ ...p, concept: e.target.value }))}
              placeholder="What are we making? Format, length, emotional promise…"
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Setting / world">
              <input
                className="lab-input"
                value={world.setting || ''}
                onChange={(e) => setWorld({ setting: e.target.value })}
                placeholder="e.g. San Francisco founder houses, 2026"
              />
            </Field>
            <Field label="Time period">
              <input
                className="lab-input"
                value={world.timePeriod || ''}
                onChange={(e) => setWorld({ timePeriod: e.target.value })}
                placeholder="Present day / near future…"
              />
            </Field>
            <Field label="Tone">
              <input
                className="lab-input"
                value={world.tone || ''}
                onChange={(e) => setWorld({ tone: e.target.value })}
                placeholder="Deadpan comedy / prestige drama / kinetic satire…"
              />
            </Field>
            <Field label="Audience">
              <input
                className="lab-input"
                value={world.audience || ''}
                onChange={(e) => setWorld({ audience: e.target.value })}
                placeholder="Who is this for?"
              />
            </Field>
          </div>
          <Field label="Themes">
            <input
              className="lab-input"
              value={world.themes || ''}
              onChange={(e) => setWorld({ themes: e.target.value })}
              placeholder="Ambition vs friendship, status anxiety…"
            />
          </Field>
          <Field label="Visual laws (how this world always looks)">
            <textarea
              className="lab-input min-h-[70px]"
              value={world.visualLaws || ''}
              onChange={(e) => setWorld({ visualLaws: e.target.value })}
              placeholder="2D cartoon cel, SF fog palette, thick outlines, never photoreal…"
            />
          </Field>
          <Field label="What this world NEVER does">
            <input
              className="lab-input"
              value={world.whatNever || ''}
              onChange={(e) => setWorld({ whatNever: e.target.value })}
              placeholder="No magical powers / no random celebrity cameos…"
            />
          </Field>
          <Field label="North star (one line the lab serves)">
            <input
              className="lab-input"
              value={world.northStar || ''}
              onChange={(e) => setWorld({ northStar: e.target.value })}
              placeholder="Every joke must cost someone status."
            />
          </Field>
          <Field label="Style DNA / global look (feeds generation)">
            <textarea
              className="lab-input min-h-[70px]"
              value={project.style?.description || ''}
              onChange={(e) =>
                onUpdate((p) => ({
                  ...p,
                  style: { ...p.style, description: e.target.value },
                }))
              }
              placeholder="Or set this from ENSEMBLE → Style DNA"
            />
          </Field>
          <button type="button" onClick={onGoEnsemble} className="btn-outline text-sm px-5 py-2 rounded-2xl">
            Open Ensemble (Style DNA + Cast)
          </button>
        </div>
      )}

      {/* SCRIPT */}
      {station === 'narrative' && (
        <NarrativeEnginePanel
          project={project}
          token={token ?? null}
          onUpdate={onUpdate}
          onCreditBalance={onCreditBalance}
          onAuthRequired={onAuthRequired}
          onGoStoryboard={onGoStoryboard}
        />
      )}

      {station === 'script' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-white/10 bg-black/40 text-xs text-white/55">
            Write like a teleplay. Use <span className="text-white/80">CHARACTER</span> on its own
            line, then dialogue — or <span className="text-white/80">NAME: line</span>. Scene headers
            like <span className="text-white/80">INT. OFFICE — DAY</span> are fine. Then push dialogue
            onto the shot list.
          </div>
          <Field label="Master script / teleplay">
            <textarea
              className="lab-input min-h-[320px] font-mono text-sm leading-relaxed"
              value={project.script || ''}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`COLD OPEN\n\nALEX\nWhat if we just ship the pitch without a product?\n\nJORDAN\nThat's not a pitch. That's a crime.\n\nINT. WAR ROOM — NIGHT\n...`}
            />
          </Field>
          <div className="text-xs text-white/40">
            {project.script?.length || 0} characters · dialogue lands on shots in order when you push
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={pushScriptToShots} className="btn-gold text-black text-sm px-6 py-2.5 rounded-2xl">
              Push script → shot dialogue
            </button>
            <button type="button" onClick={onGoStoryboard} className="btn-outline text-sm px-5 py-2.5 rounded-2xl">
              Open storyboard
            </button>
          </div>
          <Field label="Synopsis / treatment (episode or film overview)">
            <textarea
              className="lab-input min-h-[100px]"
              value={project.synopsis || ''}
              onChange={(e) => onUpdate((p) => ({ ...p, synopsis: e.target.value }))}
              placeholder="Beat-by-beat treatment if you want it separate from the spoken script…"
            />
          </Field>
        </div>
      )}

      {/* CAST DIRECTION */}
      {station === 'cast-direction' && (
        <div className="space-y-4">
          {cast.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-white/15 text-center">
              <p className="text-white/60 mb-4">No cast yet. Build characters, then direct them here.</p>
              <button type="button" onClick={onGoEnsemble} className="btn-gold text-black px-6 py-2 rounded-2xl text-sm">
                Open Ensemble Atelier
              </button>
            </div>
          ) : (
            cast.map((c) => (
              <div key={c.id} className="director-card p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                  {c.referenceImageUrl && (
                    <img
                      src={c.referenceImageUrl}
                      alt={c.name}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10"
                    />
                  )}
                  <div>
                    <div className="font-display text-2xl">{c.name || 'Unnamed'}</div>
                    <div className="text-xs text-white/50">{c.role || 'Role TBD'}</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Objective (what they want)">
                    <input
                      className="lab-input"
                      value={c.objective || ''}
                      onChange={(e) => updateChar(c.id, { objective: e.target.value })}
                      placeholder="Win the round / hide the failure / get the term sheet"
                    />
                  </Field>
                  <Field label="Arc (how they change)">
                    <input
                      className="lab-input"
                      value={c.arc || ''}
                      onChange={(e) => updateChar(c.id, { arc: e.target.value })}
                      placeholder="Cocky → cracked → honest"
                    />
                  </Field>
                </div>
                <Field label="Direction notes (how to play them)">
                  <textarea
                    className="lab-input min-h-[70px]"
                    value={c.directionNotes || ''}
                    onChange={(e) => updateChar(c.id, { directionNotes: e.target.value })}
                    placeholder="Never raise voice; weaponized calm; always checking phone for status…"
                  />
                </Field>
                <Field label="Relationships">
                  <input
                    className="lab-input"
                    value={c.relationships || ''}
                    onChange={(e) => updateChar(c.id, { relationships: e.target.value })}
                    placeholder="Loves Jordan, competes with rival CEO…"
                  />
                </Field>
                <Field label="Speech fingerprint / catchphrase energy">
                  <input
                    className="lab-input"
                    value={c.catchphrase || ''}
                    onChange={(e) => updateChar(c.id, { catchphrase: e.target.value })}
                    placeholder="Starts every pitch with “Here's the thing—”"
                  />
                </Field>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONTINUITY */}
      {station === 'continuity' && (
        <div className="space-y-4">
          <Field label="Locations (list / rules)">
            <textarea
              className="lab-input min-h-[70px]"
              value={continuity.locations || ''}
              onChange={(e) => setContinuity({ locations: e.target.value })}
              placeholder="War room, roof deck, Mission coffee, always SF fog outside…"
            />
          </Field>
          <Field label="Wardrobe rules">
            <textarea
              className="lab-input min-h-[70px]"
              value={continuity.wardrobeRules || ''}
              onChange={(e) => setContinuity({ wardrobeRules: e.target.value })}
              placeholder="Alex always black hoodie + blazer; never change mid-episode without beat…"
            />
          </Field>
          <Field label="Props / signature objects">
            <input
              className="lab-input"
              value={continuity.props || ''}
              onChange={(e) => setContinuity({ props: e.target.value })}
              placeholder="Broken laser pointer, pitch deck laptop with crack…"
            />
          </Field>
          <Field label="Timeline / day structure">
            <input
              className="lab-input"
              value={continuity.timeline || ''}
              onChange={(e) => setContinuity({ timeline: e.target.value })}
              placeholder="One night before demo day"
            />
          </Field>
          <Field label="Do not break (hard continuity)">
            <textarea
              className="lab-input min-h-[70px]"
              value={continuity.doNotBreak || ''}
              onChange={(e) => setContinuity({ doNotBreak: e.target.value })}
              placeholder="Same scar on left eyebrow; office plant is dead; no magic…"
            />
          </Field>
        </div>
      )}

      {/* READINESS */}
      {station === 'readiness' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl border border-white/10 bg-black/40">
            <div className="text-sm text-white/60 mb-1">Lab readiness score</div>
            <div className="font-mono text-5xl text-[var(--gold)] mb-2">{readiness.score}%</div>
            <p className="text-xs text-white/45">
              Not a gate — a director checklist before you spend generation.
            </p>
          </div>
          <div className="space-y-2">
            {readiness.checks.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-3 p-3 rounded-2xl border ${
                  c.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-black/30'
                }`}
              >
                <div className={`text-sm font-mono ${c.ok ? 'text-emerald-400' : 'text-white/30'}`}>
                  {c.ok ? 'OK' : '—'}
                </div>
                <div>
                  <div className="text-sm text-white/90">{c.label}</div>
                  <div className="text-xs text-white/45">{c.hint}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={onGoStoryboard} className="btn-outline px-5 py-2.5 rounded-2xl text-sm">
              Storyboard / shot control
            </button>
            <button type="button" onClick={onGoEnsemble} className="btn-outline px-5 py-2.5 rounded-2xl text-sm">
              Ensemble / cast visuals
            </button>
            <button type="button" onClick={onGoClips} className="btn-gold text-black px-6 py-2.5 rounded-2xl text-sm">
              Generate frames &amp; video
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.lab-input) {
          width: 100%;
          padding: 0.75rem 1rem;
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
      <div className="text-[11px] tracking-wide text-white/45 mb-1.5 uppercase">{label}</div>
      {children}
    </div>
  );
}
