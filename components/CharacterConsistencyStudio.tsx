'use client';

/**
 * CHARACTER CONSISTENCY — separate from environments.
 * Build, lock, pack, and inject cast. Shot list tags characters independently of sets.
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Character, Project } from '@/lib/types';
import {
  CHARACTER_AGENT_STEPS,
  type AgentAnswers,
  type CharacterPack,
  agentAnswersToCharacter,
  characterToPack,
  downloadPackJson,
  loadCharacterPacks,
  lockCharacter,
  packToCharacter,
  parsePackJson,
  saveCharacterPacks,
} from '@/lib/consistency-packs';

type Panel = 'cast' | 'agent' | 'library';

type Props = {
  project: Project;
  token?: string | null;
  onUpdate: (updater: (p: Project) => Project) => void;
  onGenerateRef?: (charId: string) => void;
  onCaptureSoloPlate?: (charId: string) => void;
  onGoStoryboard?: () => void;
  onCreditBalance?: (n: number) => void;
};

const emptyAnswers = (): AgentAnswers => ({
  name: '',
  role: '',
  ageVibe: '',
  face: '',
  wardrobe: '',
  personality: '',
  want: '',
  medium: 'cartoon-2d',
  world: '',
});

export default function CharacterConsistencyStudio({
  project,
  token,
  onUpdate,
  onGenerateRef,
  onCaptureSoloPlate,
  onGoStoryboard,
}: Props) {
  const [panel, setPanel] = useState<Panel>('cast');
  const [charPacks, setCharPacks] = useState<CharacterPack[]>([]);
  const [agentStep, setAgentStep] = useState(0);
  const [answers, setAnswers] = useState<AgentAnswers>(emptyAnswers());

  useEffect(() => {
    setCharPacks(loadCharacterPacks());
  }, []);

  const cast = project.characters || [];

  function lockChar(id: string) {
    onUpdate((p) => ({
      ...p,
      characters: (p.characters || []).map((c) => (c.id === id ? lockCharacter(c) : c)),
    }));
    const c = cast.find((x) => x.id === id);
    if (c) {
      const pack = characterToPack(lockCharacter(c));
      const next = [pack, ...charPacks.filter((p) => p.id !== pack.id)];
      setCharPacks(next);
      saveCharacterPacks(next);
      toast.success(`Locked ${c.name}`, {
        description: 'Insert them on any shot from SHOT LIST. AI must not redesign face/wardrobe.',
      });
    }
  }

  function insertOnAllShots(charId: string) {
    onUpdate((p) => ({
      ...p,
      shots: (p.shots || []).map((s) => {
        const ids = new Set(s.characterIds || []);
        ids.add(charId);
        return { ...s, characterIds: [...ids] };
      }),
    }));
    toast.success('Character inserted on every shot');
    onGoStoryboard?.();
  }

  function saveCharPack(id: string) {
    const c = cast.find((x) => x.id === id);
    if (!c) return;
    const pack = characterToPack(c.consistencyLock?.locked ? c : lockCharacter(c));
    const next = [pack, ...charPacks.filter((p) => p.id !== pack.id)];
    setCharPacks(next);
    saveCharacterPacks(next);
    downloadPackJson(pack);
    toast.success('Character pack downloaded');
  }

  function injectCharPack(pack: CharacterPack) {
    const char = packToCharacter(pack);
    onUpdate((p) => ({
      ...p,
      characters: [...(p.characters || []).filter((c) => c.name !== char.name), char],
    }));
    toast.success(`Injected ${char.name} — tag them on shots to use`);
  }

  function finishAgent() {
    if (!answers.name.trim()) {
      toast.error('Give them a name');
      return;
    }
    const char = agentAnswersToCharacter(answers);
    onUpdate((p) => ({
      ...p,
      characters: [...(p.characters || []), char],
    }));
    const pack = characterToPack(char);
    const next = [pack, ...charPacks];
    setCharPacks(next);
    saveCharacterPacks(next);
    setAnswers(emptyAnswers());
    setAgentStep(0);
    setPanel('cast');
    toast.success(`${char.name} created & locked`);
    if (onGenerateRef) setTimeout(() => onGenerateRef(char.id), 100);
  }

  function importPackFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const pack = parsePackJson(String(reader.result || ''));
      if (!pack || pack.kind !== 'character') {
        toast.error('Need a character pack (.mdpack.json with kind: character)');
        return;
      }
      const next = [pack, ...charPacks.filter((p) => p.id !== pack.id)];
      setCharPacks(next);
      saveCharacterPacks(next);
      injectCharPack(pack);
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Character consistency · separate from sets
        </div>
        <div className="font-display text-4xl tracking-tight">Cast locks</div>
        <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
          Characters live here — lock model sheets, download packs, inject into any project. On{' '}
          <strong className="text-white/80">SHOT LIST</strong>, insert cast into each shot independently
          of environments. Environments are under <strong className="text-white/80">SETS</strong>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ['cast', 'Project cast'],
            ['agent', 'Character agent'],
            ['library', 'Pack library'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`px-3 py-2 rounded-full text-sm ${
              panel === id ? 'bg-[var(--gold)] text-black' : 'bg-white/5 text-white/60 border border-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {panel === 'cast' && (
        <div className="space-y-4">
          {cast.length === 0 ? (
            <div className="p-8 border border-dashed border-white/15 rounded-3xl text-center text-white/50">
              No cast. Use Character agent, Ensemble, or inject a pack — then lock.
            </div>
          ) : (
            cast.map((c) => {
              const hasSolo = (c.tags || []).includes('solo-plate');
              const needsSolo =
                (c.tags || []).includes('needs-solo-plate') ||
                ((c.tags || []).includes('discovered') && !hasSolo);
              return (
              <div key={c.id} className="director-card p-5 rounded-3xl flex flex-wrap gap-4 items-start">
                {c.referenceImageUrl && (
                  <img
                    src={c.referenceImageUrl}
                    alt={c.name}
                    className="w-20 h-20 rounded-2xl object-cover border border-white/10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-2xl">{c.name}</div>
                    {c.consistencyLock?.locked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        LOCKED
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40">
                        unlocked
                      </span>
                    )}
                    {hasSolo ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--cyan)]/20 text-[var(--cyan)]">
                        SOLO PLATE
                      </span>
                    ) : needsSolo ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200">
                        NEEDS SOLO PLATE
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-white/50">
                    {c.role}
                    {c.subjectHint ? ` · ${c.subjectHint}` : ''}
                    {c.visibility ? ` · ${c.visibility}` : ''}
                  </div>
                  <p className="text-sm text-white/70 mt-1 line-clamp-2">{c.description}</p>
                  {needsSolo && (
                    <p className="text-[10px] text-amber-200/80 mt-1">
                      Still on a group still — capture a solo plate so reinsert keeps this identity.
                    </p>
                  )}
                  <div className="mt-2 grid sm:grid-cols-2 gap-2">
                    <select
                      className="lab-input text-xs bg-black"
                      value={c.ttsVoiceId || c.voiceProfile?.presetVoiceId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        onUpdate((p) => ({
                          ...p,
                          characters: (p.characters || []).map((x) =>
                            x.id === c.id
                              ? {
                                  ...x,
                                  ttsVoiceId: v || undefined,
                                  voiceProfile: {
                                    ...(x.voiceProfile || {}),
                                    presetVoiceId: v || undefined,
                                  },
                                }
                              : x
                          ),
                        }));
                      }}
                    >
                      <option value="">Voice preset…</option>
                      {['ara', 'eve', 'leo', 'rex', 'sal'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      className="lab-input text-xs"
                      placeholder="Tone / speech patterns"
                      value={c.voiceProfile?.tone || c.voiceProfile?.speechPatterns || ''}
                      onChange={(e) => {
                        const tone = e.target.value;
                        onUpdate((p) => ({
                          ...p,
                          characters: (p.characters || []).map((x) =>
                            x.id === c.id
                              ? {
                                  ...x,
                                  voiceProfile: {
                                    ...(x.voiceProfile || {}),
                                    tone,
                                    speechPatterns: tone,
                                    presetVoiceId: x.ttsVoiceId || x.voiceProfile?.presetVoiceId,
                                  },
                                }
                              : x
                          ),
                        }));
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => lockChar(c.id)} className="btn-gold text-black text-xs px-4 py-2 rounded-xl">
                    Lock character
                  </button>
                  <button type="button" onClick={() => insertOnAllShots(c.id)} className="btn-outline text-xs px-4 py-2 rounded-xl">
                    Insert on all shots
                  </button>
                  {(needsSolo || c.referenceImageUrl) && (
                    <button
                      type="button"
                      onClick={() => onCaptureSoloPlate?.(c.id)}
                      className="btn-outline text-xs px-4 py-2 rounded-xl border-amber-400/40 text-amber-100"
                    >
                      Capture solo plate
                    </button>
                  )}
                  <button type="button" onClick={() => onGenerateRef?.(c.id)} className="btn-outline text-xs px-4 py-2 rounded-xl">
                    Gen reference
                  </button>
                  <button type="button" onClick={() => saveCharPack(c.id)} className="btn-outline text-xs px-4 py-2 rounded-xl">
                    Download pack
                  </button>
                </div>
              </div>
              );
            })
          )}
          <p className="text-xs text-white/40">
            On SHOT LIST: tap cast chips to insert/remove characters per shot. Multiple tags = multi-character
            interaction.
          </p>
        </div>
      )}

      {panel === 'agent' && (
        <div className="director-card p-6 rounded-3xl max-w-xl space-y-4">
          <div className="text-[10px] tracking-widest uppercase text-[var(--cyan)]">Character-building agent</div>
          <p className="text-sm text-white/55">
            Step {agentStep + 1} of {CHARACTER_AGENT_STEPS.length}
          </p>
          <div className="font-display text-2xl">{CHARACTER_AGENT_STEPS[agentStep].question}</div>
          <input
            className="lab-input"
            placeholder={CHARACTER_AGENT_STEPS[agentStep].placeholder}
            value={answers[CHARACTER_AGENT_STEPS[agentStep].field]}
            onChange={(e) =>
              setAnswers({ ...answers, [CHARACTER_AGENT_STEPS[agentStep].field]: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (agentStep < CHARACTER_AGENT_STEPS.length - 1) setAgentStep((s) => s + 1);
                else finishAgent();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={agentStep === 0}
              onClick={() => setAgentStep((s) => Math.max(0, s - 1))}
              className="btn-outline text-sm px-4 py-2 rounded-xl disabled:opacity-30"
            >
              Back
            </button>
            {agentStep < CHARACTER_AGENT_STEPS.length - 1 ? (
              <button type="button" onClick={() => setAgentStep((s) => s + 1)} className="btn-gold text-black text-sm px-5 py-2 rounded-xl">
                Next
              </button>
            ) : (
              <button type="button" onClick={finishAgent} className="btn-gold text-black text-sm px-5 py-2 rounded-xl">
                Create & lock character
              </button>
            )}
          </div>
        </div>
      )}

      {panel === 'library' && (
        <div className="space-y-4">
          <label className="btn-outline text-sm px-4 py-2 rounded-xl cursor-pointer inline-block">
            Import character pack
            <input
              type="file"
              accept=".json,.mdpack.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importPackFile(f);
              }}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {charPacks.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl border border-white/10 bg-black/40">
                <div className="font-display text-lg">{p.name}</div>
                <div className="text-xs text-white/45">{p.role}</div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => injectCharPack(p)} className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl">
                    Inject into cast
                  </button>
                  <button type="button" onClick={() => downloadPackJson(p)} className="btn-outline text-xs px-3 py-1.5 rounded-xl">
                    Download
                  </button>
                </div>
              </div>
            ))}
            {!charPacks.length && <div className="text-white/40 text-sm">No character packs yet.</div>}
          </div>
        </div>
      )}

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
      `}</style>
    </div>
  );
}
