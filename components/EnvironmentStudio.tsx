'use client';

/**
 * ENVIRONMENT CONSISTENCY — separate from characters.
 * Lock homes, offices, cafés; insert per shot independently of cast.
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { EnvironmentLocation, Project } from '@/lib/types';
import {
  type EnvironmentPack,
  createEnvironmentPack,
  downloadPackJson,
  loadEnvironmentPacks,
  parsePackJson,
  saveEnvironmentPacks,
} from '@/lib/consistency-packs';

type Panel = 'sets' | 'library';

type Props = {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
  onGenerateEnvRef?: (envId: string) => void;
  onGoStoryboard?: () => void;
};

export default function EnvironmentStudio({
  project,
  onUpdate,
  onGenerateEnvRef,
  onGoStoryboard,
}: Props) {
  const [panel, setPanel] = useState<Panel>('sets');
  const [envPacks, setEnvPacks] = useState<EnvironmentPack[]>([]);
  const [envForm, setEnvForm] = useState({
    name: '',
    placeType: 'office',
    description: '',
    lighting: '',
    props: '',
    layoutNotes: '',
    styleNotes: '',
  });

  useEffect(() => {
    setEnvPacks(loadEnvironmentPacks());
  }, []);

  const envs = project.environments || [];

  function addEnvironment() {
    if (!envForm.name.trim() || !envForm.description.trim()) {
      toast.error('Name and description required');
      return;
    }
    const pack = createEnvironmentPack({
      name: envForm.name.trim(),
      placeType: envForm.placeType,
      description: envForm.description.trim(),
      lighting: envForm.lighting,
      signatureProps: envForm.props,
      layoutNotes: envForm.layoutNotes,
      styleNotes: envForm.styleNotes,
    });
    const loc: EnvironmentLocation = {
      id: pack.id,
      name: pack.name,
      placeType: pack.placeType,
      description: pack.description,
      lighting: pack.lighting,
      architecture: pack.architecture,
      signatureProps: pack.signatureProps,
      layoutNotes: envForm.layoutNotes || undefined,
      styleNotes: envForm.styleNotes || undefined,
      referenceImageUrl: pack.lock.referenceUrls[0],
      consistencyLock: pack.lock,
      packId: pack.id,
    };
    onUpdate((p) => ({
      ...p,
      environments: [...(p.environments || []).filter((e) => e.id !== loc.id), loc],
      defaultEnvironmentId: loc.id,
      // Bind new set onto empty shots so the next gen inherits it automatically
      shots: (p.shots || []).map((s) =>
        !s.imageUrl && !s.videoUrl && !s.environmentId ? { ...s, environmentId: loc.id } : s
      ),
    }));
    const next = [pack, ...envPacks];
    setEnvPacks(next);
    saveEnvironmentPacks(next);
    setEnvForm({
      name: '',
      placeType: 'office',
      description: '',
      lighting: '',
      props: '',
      layoutNotes: '',
      styleNotes: '',
    });
    toast.success(`Locked location: ${loc.name}`, {
      description: existingPlateHint(loc)
        ? 'Plate attached. Generate frames — they image-edit from this set.'
        : 'Location saved in the library. Gen a set ref, then reuse across the episode.',
    });
  }

  function existingPlateHint(loc: EnvironmentLocation) {
    return !!(loc.referenceImageUrl || loc.consistencyLock?.referenceUrls?.length);
  }

  function insertOnAllShots(envId: string) {
    onUpdate((p) => ({
      ...p,
      defaultEnvironmentId: envId,
      shots: (p.shots || []).map((s) => ({ ...s, environmentId: envId })),
    }));
    toast.success('Environment inserted on every shot');
    onGoStoryboard?.();
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
    toast.success(`Injected set: ${loc.name} — pick it per shot on SHOT LIST`);
  }

  function importPackFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const pack = parsePackJson(String(reader.result || ''));
      if (!pack || pack.kind !== 'environment') {
        toast.error('Need an environment pack (kind: environment)');
        return;
      }
      const next = [pack, ...envPacks.filter((p) => p.id !== pack.id)];
      setEnvPacks(next);
      saveEnvironmentPacks(next);
      injectEnvPack(pack);
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--cyan)] mb-1">
          Environment consistency · separate from cast
        </div>
        <div className="font-display text-4xl tracking-tight">Sets & places</div>
        <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
          Homes, offices, cafés — locked so sequels reuse the same room. Characters are under{' '}
          <strong className="text-white/80">CAST LOCK</strong>. On each shot you insert{' '}
          <em>who</em> and <em>where</em> separately: cast chips + set dropdown.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setPanel('sets')}
          className={`px-3 py-2 rounded-full text-sm ${
            panel === 'sets' ? 'bg-[var(--cyan)]/90 text-black' : 'bg-white/5 text-white/60 border border-white/10'
          }`}
        >
          Project sets
        </button>
        <button
          type="button"
          onClick={() => setPanel('library')}
          className={`px-3 py-2 rounded-full text-sm ${
            panel === 'library' ? 'bg-[var(--cyan)]/90 text-black' : 'bg-white/5 text-white/60 border border-white/10'
          }`}
        >
          Pack library
        </button>
      </div>

      {panel === 'sets' && (
        <div className="space-y-6">
          <div className="director-card p-5 rounded-3xl space-y-3">
            <div className="text-[10px] tracking-widest uppercase text-white/40">
              Location library · new place
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="lab-input"
                placeholder="Name (e.g. War Room / Main St)"
                value={envForm.name}
                onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
              />
              <select
                className="lab-input bg-black"
                value={envForm.placeType}
                onChange={(e) => setEnvForm({ ...envForm, placeType: e.target.value })}
              >
                {['home', 'office', 'cafe', 'exterior', 'lab', 'rooftop', 'town', 'building', 'other'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                className="lab-input min-h-[70px] sm:col-span-2"
                placeholder="Description — architecture, colors, furniture…"
                value={envForm.description}
                onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })}
              />
              <input
                className="lab-input"
                placeholder="Lighting"
                value={envForm.lighting}
                onChange={(e) => setEnvForm({ ...envForm, lighting: e.target.value })}
              />
              <input
                className="lab-input"
                placeholder="Signature props"
                value={envForm.props}
                onChange={(e) => setEnvForm({ ...envForm, props: e.target.value })}
              />
              <input
                className="lab-input sm:col-span-2"
                placeholder="Layout notes — floor plan, exits, geography for procedural reuse"
                value={envForm.layoutNotes}
                onChange={(e) => setEnvForm({ ...envForm, layoutNotes: e.target.value })}
              />
              <input
                className="lab-input sm:col-span-2"
                placeholder="Style notes — keep this place coherent across shots"
                value={envForm.styleNotes}
                onChange={(e) => setEnvForm({ ...envForm, styleNotes: e.target.value })}
              />
            </div>
            <button type="button" onClick={addEnvironment} className="btn-gold text-black text-sm px-5 py-2 rounded-xl">
              Lock location
            </button>
          </div>

          {envs.map((env) => (
            <div key={env.id} className="director-card p-5 rounded-3xl flex flex-wrap gap-4">
              {env.referenceImageUrl && (
                <img
                  src={env.referenceImageUrl}
                  alt={env.name}
                  className="w-28 h-18 object-cover rounded-xl border border-white/10"
                />
              )}
              <div className="flex-1">
                <div className="font-display text-xl">{env.name}</div>
                <div className="text-xs text-white/45 uppercase">{env.placeType}</div>
                <p className="text-sm text-white/70 mt-1">{env.description}</p>
                {project.defaultEnvironmentId === env.id && (
                  <span className="text-[10px] text-[var(--cyan)] mt-1 inline-block">Default set</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs px-3 py-1.5 rounded-xl"
                  onClick={() => onUpdate((p) => ({ ...p, defaultEnvironmentId: env.id }))}
                >
                  Make default
                </button>
                <button type="button" onClick={() => insertOnAllShots(env.id)} className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl">
                  Insert on all shots
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

          {!envs.length && (
            <p className="text-white/40 text-sm">No sets yet. Lock an office or café for series reuse.</p>
          )}

          <p className="text-xs text-white/40">
            On SHOT LIST: use the <strong className="text-white/60">Set / environment</strong> dropdown on each
            card — independent of cast tags.
          </p>
        </div>
      )}

      {panel === 'library' && (
        <div className="space-y-4">
          <label className="btn-outline text-sm px-4 py-2 rounded-xl cursor-pointer inline-block">
            Import environment pack
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
            {envPacks.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl border border-white/10 bg-black/40">
                <div className="font-display text-lg">{p.name}</div>
                <div className="text-xs text-white/45">{p.placeType}</div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => injectEnvPack(p)} className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl">
                    Inject into project
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
