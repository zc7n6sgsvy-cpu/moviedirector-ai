'use client';

/**
 * Creative Discovery — AI invents; you harvest cast/sets into the bank.
 *
 * 1) Expand empty shot from script + seed shots (cheap text)
 * 2) Discover people/place from a generated frame (vision)
 * 3) Accept/rename/delete → lock into project + pack library
 * 4) Reuse on later empty shots
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project, Shot } from '@/lib/types';
import {
  type DiscoveredCharacter,
  type DiscoveredEnvironment,
  type FrameDiscovery,
  discoveredToCharacter,
  discoveredToEnvironment,
} from '@/lib/discover-from-frame';
import {
  characterToPack,
  createEnvironmentPack,
  loadCharacterPacks,
  loadEnvironmentPacks,
  saveCharacterPacks,
  saveEnvironmentPacks,
} from '@/lib/consistency-packs';
import { bindEnvironmentAcrossProject } from '@/lib/continuity-refs';
import { isTransitionShot } from '@/lib/transitions';

type Props = {
  project: Project;
  token: string | null;
  onUpdate: (updater: (p: Project) => Project) => void;
  onCreditBalance?: (n: number) => void;
  onAuthRequired?: () => void;
  onGenerateFrame?: (shotId: string) => void;
};

export default function CreativeDiscoveryPanel({
  project,
  token,
  onUpdate,
  onCreditBalance,
  onAuthRequired,
  onGenerateFrame,
}: Props) {
  const storyShots = useMemo(
    () => (project.shots || []).filter((s) => !isTransitionShot(s)),
    [project.shots]
  );

  const [seedIds, setSeedIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState('');
  const [discoverShotId, setDiscoverShotId] = useState('');
  const [busy, setBusy] = useState<'expand' | 'discover' | null>(null);
  const [discovery, setDiscovery] = useState<FrameDiscovery | null>(null);
  const [discImage, setDiscImage] = useState<string | null>(null);
  const [chars, setChars] = useState<DiscoveredCharacter[]>([]);
  const [env, setEnv] = useState<DiscoveredEnvironment | null>(null);

  const emptyShots = storyShots.filter((s) => !s.imageUrl && !s.videoUrl);
  const framedShots = storyShots.filter((s) => !!s.imageUrl);

  function toggleSeed(id: string) {
    setSeedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function expandScene() {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    if (!targetId) {
      toast.error('Pick an empty (or any) shot to fill with an AI scene beat');
      return;
    }
    setBusy('expand');
    try {
      const res = await fetch('/api/generate/expand-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: project.id,
          seedShotIds: seedIds,
          targetShotId: targetId,
          creative: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Expand failed');
      const ex = data.expanded as {
        description: string;
        camera: string;
        dialogue?: string;
        emotion?: string;
        suggestedCharacterNames?: string[];
        environmentHint?: string;
      };

      // Map suggested names → character ids when possible
      const nameToId = new Map(
        (project.characters || []).map((c) => [c.name.toLowerCase(), c.id])
      );
      const characterIds = (ex.suggestedCharacterNames || [])
        .map((n) => nameToId.get(n.toLowerCase()))
        .filter(Boolean) as string[];

      let environmentId: string | undefined;
      if (ex.environmentHint) {
        const hit = (project.environments || []).find(
          (e) =>
            e.name.toLowerCase().includes(ex.environmentHint!.toLowerCase()) ||
            ex.environmentHint!.toLowerCase().includes(e.name.toLowerCase())
        );
        environmentId = hit?.id || project.defaultEnvironmentId;
      }

      onUpdate((p) => ({
        ...p,
        shots: (p.shots || []).map((s) =>
          s.id === targetId
            ? {
                ...s,
                description: ex.description,
                camera: ex.camera || s.camera,
                dialogue: ex.dialogue || s.dialogue,
                emotion: ex.emotion || s.emotion,
                characterIds: characterIds.length ? characterIds : s.characterIds,
                environmentId: environmentId || s.environmentId,
              }
            : s
        ),
      }));
      if (typeof data.creditBalance === 'number') onCreditBalance?.(data.creditBalance);
      toast.success('Scene beat written onto the shot (−1 cr)', {
        description: 'Generate FRAME next, then Discover cast/set if AI invented new people.',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Expand failed');
    } finally {
      setBusy(null);
    }
  }

  async function discoverFromFrame() {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    const shot = storyShots.find((s) => s.id === discoverShotId);
    if (!shot?.imageUrl) {
      toast.error('Pick a shot that already has a frame');
      return;
    }
    setBusy('discover');
    try {
      const res = await fetch('/api/generate/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: project.id,
          imageUrl: shot.imageUrl,
          shotId: shot.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discover failed');
      const d = data.discovery as FrameDiscovery;
      setDiscovery(d);
      setDiscImage(data.imageUrl || shot.imageUrl);
      setChars(d.characters || []);
      setEnv(d.environment);
      if (typeof data.creditBalance === 'number') onCreditBalance?.(data.creditBalance);
      toast.success(
        `Found ${d.characters?.length || 0} character(s)${d.environment ? ' + 1 set' : ''} (−2 cr)`,
        { description: 'Rename, uncheck rejects, then Lock selected into bank.' }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Discover failed');
    } finally {
      setBusy(null);
    }
  }

  function toggleChar(tempId: string) {
    setChars((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, selected: !c.selected } : c))
    );
  }

  function renameChar(tempId: string, name: string) {
    setChars((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, suggestedName: name } : c))
    );
  }

  function lockSelected() {
    const keep = chars.filter((c) => c.selected);
    const envReady = env?.selected && (env.description?.trim() || env.name?.trim());
    if (!keep.length && !envReady) {
      toast.error('Select at least one character or the environment');
      return;
    }

    const ref = discImage || undefined;
    if (!ref) {
      toast.error('Missing source frame URL — re-run Discover on a shot with a public frame');
      return;
    }

    try {
      const newChars = keep.map((c) => discoveredToCharacter(c, ref));
      // Always lock env when selected — fill description from name if vision returned thin data
      const newEnv = envReady
        ? discoveredToEnvironment(
            {
              ...env!,
              name: env!.name?.trim() || 'Discovered set',
              description:
                env!.description?.trim() ||
                `Series set locked from production still. Preserve architecture and props exactly.`,
              placeType: env!.placeType || 'other',
            },
            ref
          )
        : null;

      // Hard-require set plate URL on locked environment
      if (newEnv && !newEnv.referenceImageUrl) {
        newEnv.referenceImageUrl = ref;
        newEnv.consistencyLock = {
          ...(newEnv.consistencyLock || {
            modelSheet: newEnv.description,
            doNotChange: 'Never redesign this location.',
            referenceUrls: [ref],
            locked: true,
          }),
          referenceUrls: [ref, ...(newEnv.consistencyLock?.referenceUrls || [])].filter(
            (u, i, a) => a.indexOf(u) === i
          ),
          locked: true,
          lockedAt: new Date().toISOString(),
        };
      }

      onUpdate((p) => {
        let characters = [...(p.characters || [])];
        for (const nc of newChars) {
          characters = characters.filter((c) => c.name.toLowerCase() !== nc.name.toLowerCase());
          characters.push(nc);
        }
        let environments = [...(p.environments || [])];
        if (newEnv) {
          environments = environments.filter(
            (e) => e.name.toLowerCase() !== newEnv.name.toLowerCase() && e.id !== newEnv.id
          );
          environments.push(newEnv);
        }

        // Tag discover shot with new cast
        let shots = (p.shots || []).map((s) => {
          if (s.id !== discoverShotId) return s;
          const ids = new Set([...(s.characterIds || []), ...newChars.map((c) => c.id)]);
          return {
            ...s,
            characterIds: [...ids],
            environmentId: newEnv?.id || s.environmentId,
          };
        });

        let next: typeof p = {
          ...p,
          characters,
          environments,
          defaultEnvironmentId: newEnv?.id || p.defaultEnvironmentId,
          shots,
        };

        // Bind locked set across empty + discover shots so shot 5–6 inherit it
        if (newEnv) {
          next = bindEnvironmentAcrossProject(next, newEnv.id, {
            onlyEmpty: true,
            alsoShotIds: discoverShotId ? [discoverShotId] : [],
          });
          // Force default to the set we just locked (user intent)
          next = { ...next, defaultEnvironmentId: newEnv.id };
        }

        return next;
      });

      // Pack library (same ids / ref URLs for re-inject elsewhere)
      try {
        const cPacks = loadCharacterPacks();
        for (const nc of newChars) {
          cPacks.unshift(characterToPack(nc));
        }
        saveCharacterPacks(cPacks.slice(0, 100));
        if (newEnv) {
          const ePacks = loadEnvironmentPacks();
          const pack = createEnvironmentPack({
            name: newEnv.name,
            placeType: newEnv.placeType,
            description: newEnv.description,
            lighting: newEnv.lighting,
            signatureProps: newEnv.signatureProps,
            referenceImageUrl: newEnv.referenceImageUrl || ref,
          });
          // Preserve project env id so re-inject matches
          pack.id = newEnv.packId || newEnv.id;
          pack.lock.referenceUrls = [
            newEnv.referenceImageUrl || ref,
            ...(pack.lock.referenceUrls || []),
          ].filter((u, i, a) => a.indexOf(u) === i);
          pack.lock.locked = true;
          ePacks.unshift(pack);
          saveEnvironmentPacks(ePacks.slice(0, 100));
        }
      } catch {
        /* localStorage optional */
      }

      toast.success(
        `Locked ${keep.length} character(s)${newEnv ? ' + set' : ''} into project & pack bank`,
        {
          description: newEnv
            ? `"${newEnv.name}" is default set + bound on empty shots. Next frames image-edit from this plate.`
            : 'Tag cast on shots. Generate with continuity lock.',
        }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lock failed', {
        description: 'Try Discover again, then lock. Need a public frame URL.',
      });
    }
  }

  function applyEnvToEmptyShots() {
    const envId = project.defaultEnvironmentId || project.environments?.[0]?.id;
    if (!envId) {
      toast.error('No environment in project yet — discover & lock a set first');
      return;
    }
    onUpdate((p) => bindEnvironmentAcrossProject(p, envId, { onlyEmpty: true }));
    toast.success('Locked set applied to empty story shots');
  }

  return (
    <div className="director-card p-5 rounded-3xl space-y-6 max-w-3xl">
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--cyan)] mb-1">
          Creative mode · invent then harvest
        </div>
        <div className="font-display text-2xl tracking-tight">AI creates · you lock what you keep</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Let Grok invent a scene. Discover people & place from the frame, name them, delete rejects,
          lock packs — then reuse on empty shots while other beats go elsewhere in the show.
        </p>
      </div>

      {/* A) Expand from script */}
      <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-white/40">
          A · Feed script / seeds → fill an empty shot (−1 cr)
        </div>
        <div>
          <div className="text-[10px] text-white/45 mb-1">Seed shots (context — multi-select)</div>
          <div className="flex flex-wrap gap-1">
            {storyShots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSeed(s.id)}
                className={`text-[10px] px-2 py-1 rounded-full border ${
                  seedIds.includes(s.id)
                    ? 'border-[var(--gold)] bg-[var(--gold)]/20 text-white'
                    : 'border-white/15 text-white/50'
                }`}
              >
                #{s.number}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-white/45 mb-1">Target shot to fill</div>
          <select
            className="director-input w-full p-2 text-sm rounded-xl bg-black"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select shot…</option>
            {storyShots.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.number} {s.imageUrl ? '(has frame)' : '(empty)'} — {(s.description || '').slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandScene}
            disabled={!!busy || !targetId}
            className="btn-gold text-black text-sm px-4 py-2 rounded-xl disabled:opacity-40"
          >
            {busy === 'expand' ? 'Writing beat…' : 'AI write scene beat'}
          </button>
          {targetId && onGenerateFrame && (
            <button
              type="button"
              onClick={() => onGenerateFrame(targetId)}
              className="btn-outline text-sm px-4 py-2 rounded-xl"
            >
              Then generate frame
            </button>
          )}
        </div>
        <p className="text-[10px] text-white/40">
          Uses logline + script + seed shots + locked cast/sets. Empty later shots (5–6) can reuse locks.
        </p>
      </div>

      {/* B) Discover from frame */}
      <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-white/40">
          B · Discover cast & set from a frame (−2 cr)
        </div>
        <select
          className="director-input w-full p-2 text-sm rounded-xl bg-black"
          value={discoverShotId}
          onChange={(e) => {
            setDiscoverShotId(e.target.value);
            setDiscovery(null);
          }}
        >
          <option value="">Pick a shot with a frame…</option>
          {framedShots.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.number} — {(s.description || '').slice(0, 48)}
            </option>
          ))}
        </select>
        {!framedShots.length && (
          <p className="text-[11px] text-amber-300/80">Generate at least one frame first.</p>
        )}
        <button
          type="button"
          onClick={discoverFromFrame}
          disabled={!!busy || !discoverShotId}
          className="btn-outline text-sm px-4 py-2 rounded-xl disabled:opacity-40"
        >
          {busy === 'discover' ? 'Scanning frame…' : 'Discover characters & environment'}
        </button>

        {discovery && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {discImage && (
              <img src={discImage} alt="Source" className="max-h-36 rounded-xl border border-white/10" />
            )}
            <div className="text-[10px] uppercase text-white/40">Characters (uncheck to discard)</div>
            {chars.map((c) => (
              <div
                key={c.tempId}
                className={`p-3 rounded-xl border flex gap-3 ${
                  c.selected ? 'border-[var(--gold)]/40 bg-[var(--gold)]/5' : 'border-white/10 opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={c.selected}
                  onChange={() => toggleChar(c.tempId)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <input
                    className="director-input w-full p-1.5 text-sm rounded-lg"
                    value={c.suggestedName}
                    onChange={(e) => renameChar(c.tempId, e.target.value)}
                    placeholder="Name"
                  />
                  <div className="text-[11px] text-white/50">{c.role}</div>
                  <div className="text-[11px] text-white/60 line-clamp-2">{c.description}</div>
                </div>
              </div>
            ))}
            {env && (
              <div
                className={`p-3 rounded-xl border ${
                  env.selected ? 'border-[var(--cyan)]/40 bg-[var(--cyan)]/5' : 'border-white/10 opacity-50'
                }`}
              >
                <label className="flex gap-2 items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={env.selected}
                    onChange={() => setEnv({ ...env, selected: !env.selected })}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-[10px] uppercase text-[var(--cyan)]/80">Environment</div>
                    <div className="font-display text-lg">{env.name}</div>
                    <div className="text-[11px] text-white/50">{env.placeType}</div>
                    <div className="text-[11px] text-white/60 mt-1">{env.description}</div>
                    {env.items?.length ? (
                      <div className="text-[10px] text-white/40 mt-1">Items: {env.items.join(', ')}</div>
                    ) : null}
                  </div>
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={lockSelected} className="btn-gold text-black text-sm px-5 py-2 rounded-xl">
                Lock selected into bank
              </button>
              <button type="button" onClick={applyEnvToEmptyShots} className="btn-outline text-sm px-4 py-2 rounded-xl">
                Apply set to empty shots
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/40 leading-relaxed">
        Flow: invent beat on shot 3 → gen frame → discover 3 people + office → lock 2 keep 1 delete → empty
        shots 5–6 insert same cast/set while shot 4 jumps to another location. Creative AI + series memory.
      </p>
    </div>
  );
}
