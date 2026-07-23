'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Character, EnvironmentLocation, Project } from '@/lib/types';
import {
  CHARACTER_AGENT_STEPS,
  type AgentAnswers,
  type CharacterPack,
  type EnvironmentPack,
  agentAnswersToCharacter,
  characterToPack,
  createEnvironmentPack,
  downloadPackJson,
  loadCharacterPacks,
  loadEnvironmentPacks,
  lockCharacter,
  packToCharacter,
  parsePackJson,
  saveCharacterPacks,
  saveEnvironmentPacks,
} from '@/lib/consistency-packs';

type Panel = 'characters' | 'environments' | 'agent' | 'library';

type Props = {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
  onGenerateRef?: (charId: string) => void;
  onGenerateEnvRef?: (envId: string) => void;
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

export default function ConsistencyStudio({
  project,
  onUpdate,
  onGenerateRef,
  onGenerateEnvRef,
}: Props) {
  const [panel, setPanel] = useState<Panel>('characters');
  const [charPacks, setCharPacks] = useState<CharacterPack[]>([]);
  const [envPacks, setEnvPacks] = useState<EnvironmentPack[]>([]);
  const [agentStep, setAgentStep] = useState(0);
  const [answers, setAnswers] = useState<AgentAnswers>(emptyAnswers());
  const [envForm, setEnvForm] = useState({
    name: '',
    placeType: 'office',
    description: '',
    lighting: '',
    props: '',
  });

  useEffect(() => {
    setCharPacks(loadCharacterPacks());
    setEnvPacks(loadEnvironmentPacks());
  }, []);

  const cast = project.characters || [];
  const envs = project.environments || [];

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
      toast.success(`Locked ${c.name} — AI must not redesign them`, {
        description: 'Saved to your character pack library. Reuse in sequels.',
      });
    }
  }

  function saveCharPack(id: string) {
    const c = cast.find((x) => x.id === id);
    if (!c) return;
    const pack = characterToPack(c.consistencyLock?.locked ? c : lockCharacter(c));
    const next = [pack, ...charPacks.filter((p) => p.id !== pack.id)];
    setCharPacks(next);
    saveCharacterPacks(next);
    downloadPackJson(pack);
    toast.success('Character pack downloaded (.mdpack.json)');
  }

  function injectCharPack(pack: CharacterPack) {
    const char = packToCharacter(pack);
    onUpdate((p) => ({
      ...p,
      characters: [...(p.characters || []).filter((c) => c.name !== char.name), char],
    }));
    toast.success(`Injected ${char.name} into project cast`);
  }

  function addEnvironment() {
    if (!envForm.name.trim() || !envForm.description.trim()) {
      toast.error('Name and description required for a locked set');
      return;
    }
    const pack = createEnvironmentPack({
      name: envForm.name.trim(),
      placeType: envForm.placeType,
      description: envForm.description.trim(),
      lighting: envForm.lighting,
      signatureProps: envForm.props,
    });
    const loc: EnvironmentLocation = {
      id: pack.id,
      name: pack.name,
      placeType: pack.placeType,
      description: pack.description,
      lighting: pack.lighting,
      architecture: pack.architecture,
      signatureProps: pack.signatureProps,
      referenceImageUrl: pack.lock.referenceUrls[0],
      consistencyLock: pack.lock,
      packId: pack.id,
    };
    onUpdate((p) => ({
      ...p,
      environments: [...(p.environments || []), loc],
      defaultEnvironmentId: p.defaultEnvironmentId || loc.id,
    }));
    const next = [pack, ...envPacks];
    setEnvPacks(next);
    saveEnvironmentPacks(next);
    setEnvForm({ name: '', placeType: 'office', description: '', lighting: '', props: '' });
    toast.success(`Locked environment: ${loc.name}`, {
      description: 'Reuse this set every episode — same office/home/café.',
    });
  }

  function downloadEnv(env: EnvironmentLocation) {
    const pack: EnvironmentPack = {
      id: env.packId || env.id,
      kind: 'environment',
      version: 1,
      name: env.name,
      placeType: env.placeType,
      description: env.description,
      lighting: env.lighting,
      architecture: env.architecture,
      signatureProps: env.signatureProps,
      lock: env.consistencyLock || {
        modelSheet: env.description,
        doNotChange: 'Never redesign this location.',
        referenceUrls: env.referenceImageUrl ? [env.referenceImageUrl] : [],
        locked: true,
      },
      createdAt: new Date().toISOString(),
    };
    downloadPackJson(pack);
    toast.success('Environment pack downloaded');
  }

  function injectEnvPack(pack: EnvironmentPack) {
    const loc: EnvironmentLocation = {
      id: pack.id,
      name: pack.name,
      placeType: pack.placeType,
      description: pack.description,
      lighting: pack.lighting,
      architecture: pack.architecture,
      signatureProps: pack.signatureProps,
      referenceImageUrl: pack.lock.referenceUrls[0],
      consistencyLock: pack.lock,
      packId: pack.id,
    };
    onUpdate((p) => ({
      ...p,
      environments: [...(p.environments || []).filter((e) => e.id !== loc.id), loc],
    }));
    toast.success(`Injected set: ${loc.name}`);
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
    setPanel('characters');
    toast.success(`${char.name} created & locked`, {
      description: 'Generate a reference still next for maximum consistency.',
    });
    if (onGenerateRef) {
      // slight delay so state commits
      setTimeout(() => onGenerateRef(char.id), 100);
    }
  }

  function importPackFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const pack = parsePackJson(String(reader.result || ''));
      if (!pack) {
        toast.error('Invalid pack file');
        return;
      }
      if (pack.kind === 'character') {
        const next = [pack, ...charPacks.filter((p) => p.id !== pack.id)];
        setCharPacks(next);
        saveCharacterPacks(next);
        injectCharPack(pack);
      } else {
        const next = [pack, ...envPacks.filter((p) => p.id !== pack.id)];
        setEnvPacks(next);
        saveEnvironmentPacks(next);
        injectEnvPack(pack);
      }
    };
    reader.readAsText(file);
  }

  const tabs: { id: Panel; label: string }[] = [
    { id: 'characters', label: 'Cast locks' },
    { id: 'environments', label: 'Sets / places' },
    { id: 'agent', label: 'Character agent' },
    { id: 'library', label: 'Pack library' },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Consistency · series bible
        </div>
        <div className="font-display text-4xl tracking-tight">Lock what must not change</div>
        <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
          Characters and environments become <strong className="text-white/80">packs</strong> — model
          sheets the AI is forbidden to wipe. Reuse the same SF office or café every episode; only the
          interaction changes. That cuts failed identity rolls and re-gen cost on sequels.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={`px-3 py-2 rounded-full text-sm ${
              panel === t.id ? 'bg-[var(--gold)] text-black' : 'bg-white/5 text-white/60 border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {panel === 'characters' && (
        <div className="space-y-4">
          {cast.length === 0 ? (
            <div className="p-8 border border-dashed border-white/15 rounded-3xl text-center text-white/50">
              No cast yet. Use Character agent or Ensemble forge, then lock them here.
            </div>
          ) : (
            cast.map((c) => (
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
                  </div>
                  <div className="text-xs text-white/50">{c.role}</div>
                  <p className="text-sm text-white/70 mt-1 line-clamp-2">{c.description}</p>
                  {c.consistencyLock?.doNotChange && (
                    <p className="text-[11px] text-amber-200/70 mt-1">Do not change: {c.consistencyLock.doNotChange}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => lockChar(c.id)} className="btn-gold text-black text-xs px-4 py-2 rounded-xl">
                    Lock character
                  </button>
                  <button type="button" onClick={() => onGenerateRef?.(c.id)} className="btn-outline text-xs px-4 py-2 rounded-xl">
                    Gen reference
                  </button>
                  <button type="button" onClick={() => saveCharPack(c.id)} className="btn-outline text-xs px-4 py-2 rounded-xl">
                    Download pack
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {panel === 'environments' && (
        <div className="space-y-6">
          <div className="director-card p-5 rounded-3xl space-y-3">
            <div className="text-[10px] tracking-widest uppercase text-white/40">New locked set</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="lab-input"
                placeholder="Name (e.g. War Room)"
                value={envForm.name}
                onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
              />
              <select
                className="lab-input bg-black"
                value={envForm.placeType}
                onChange={(e) => setEnvForm({ ...envForm, placeType: e.target.value })}
              >
                {['home', 'office', 'cafe', 'exterior', 'lab', 'rooftop', 'other'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                className="lab-input min-h-[70px] sm:col-span-2"
                placeholder="Description — architecture, colors, signature furniture…"
                value={envForm.description}
                onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })}
              />
              <input
                className="lab-input"
                placeholder="Lighting (fog morning, practical warms…)"
                value={envForm.lighting}
                onChange={(e) => setEnvForm({ ...envForm, lighting: e.target.value })}
              />
              <input
                className="lab-input"
                placeholder="Signature props"
                value={envForm.props}
                onChange={(e) => setEnvForm({ ...envForm, props: e.target.value })}
              />
            </div>
            <button type="button" onClick={addEnvironment} className="btn-gold text-black text-sm px-5 py-2 rounded-xl">
              Lock environment into project
            </button>
          </div>

          {envs.map((env) => (
            <div key={env.id} className="director-card p-5 rounded-3xl flex flex-wrap gap-4">
              {env.referenceImageUrl && (
                <img src={env.referenceImageUrl} alt={env.name} className="w-24 h-16 object-cover rounded-xl border border-white/10" />
              )}
              <div className="flex-1">
                <div className="font-display text-xl">{env.name}</div>
                <div className="text-xs text-white/45 uppercase">{env.placeType}</div>
                <p className="text-sm text-white/70 mt-1">{env.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    project.defaultEnvironmentId === env.id
                      ? 'border-[var(--gold)] text-[var(--gold)]'
                      : 'border-white/20 text-white/50'
                  }`}
                  onClick={() => onUpdate((p) => ({ ...p, defaultEnvironmentId: env.id }))}
                >
                  {project.defaultEnvironmentId === env.id ? 'Default set' : 'Make default'}
                </button>
                <button type="button" onClick={() => onGenerateEnvRef?.(env.id)} className="btn-outline text-xs px-3 py-1.5 rounded-xl">
                  Gen set ref
                </button>
                <button type="button" onClick={() => downloadEnv(env)} className="btn-outline text-xs px-3 py-1.5 rounded-xl">
                  Download pack
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {panel === 'agent' && (
        <div className="director-card p-6 rounded-3xl max-w-xl space-y-4">
          <div className="text-[10px] tracking-widest uppercase text-[var(--cyan)]">Character-building agent</div>
          <p className="text-sm text-white/55">
            Step {agentStep + 1} of {CHARACTER_AGENT_STEPS.length}. Answers become a locked model sheet.
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
              <button
                type="button"
                onClick={() => setAgentStep((s) => s + 1)}
                className="btn-gold text-black text-sm px-5 py-2 rounded-xl"
              >
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
        <div className="space-y-6">
          <div>
            <label className="btn-outline text-sm px-4 py-2 rounded-xl cursor-pointer inline-block">
              Import pack (.mdpack.json)
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
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Character packs</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {charPacks.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl border border-white/10 bg-black/40">
                  <div className="font-display text-lg">{p.name}</div>
                  <div className="text-xs text-white/45">{p.role}</div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => injectCharPack(p)} className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl">
                      Inject
                    </button>
                    <button type="button" onClick={() => downloadPackJson(p)} className="btn-outline text-xs px-3 py-1.5 rounded-xl">
                      Download
                    </button>
                  </div>
                </div>
              ))}
              {!charPacks.length && <div className="text-white/40 text-sm">No saved character packs yet.</div>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Environment packs</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {envPacks.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl border border-white/10 bg-black/40">
                  <div className="font-display text-lg">{p.name}</div>
                  <div className="text-xs text-white/45">{p.placeType}</div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => injectEnvPack(p)} className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl">
                      Inject
                    </button>
                    <button type="button" onClick={() => downloadPackJson(p)} className="btn-outline text-xs px-3 py-1.5 rounded-xl">
                      Download
                    </button>
                  </div>
                </div>
              ))}
              {!envPacks.length && <div className="text-white/40 text-sm">No environment packs yet.</div>}
            </div>
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
