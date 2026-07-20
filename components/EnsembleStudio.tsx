'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Character, Project } from '@/lib/types';
import {
  CHARACTER_MEDIUMS,
  PERSONA_ARCHETYPES,
  buildCharacterDescription,
  type CharacterMedium,
  type VoiceAxes,
  DEFAULT_VOICE_AXES,
} from '@/lib/ensemble';
import {
  STYLE_DNA_PACKS,
  buildStyleDescriptionFromDna,
  getStyleDna,
  type StyleDnaId,
} from '@/lib/style-dna';
import {
  generateVoiceAlternates,
  SATIRE_VOICE_PRESETS,
  describeAxes,
} from '@/lib/voice-lab';

const COMPANY_KEY = 'moviedirector_company';

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function loadCompany(): Character[] {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCompany(list: Character[]) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(list));
}

type Panel = 'dna' | 'forge' | 'company' | 'voices';

type Props = {
  project: Project;
  token: string | null;
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onGenerateRef?: (charId: string) => void;
};

export default function EnsembleStudio({
  project,
  token,
  onUpdateProject,
  onGenerateRef,
}: Props) {
  const [panel, setPanel] = useState<Panel>('dna');
  const [company, setCompany] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  // Forge form
  const [forge, setForge] = useState({
    name: '',
    role: 'Lead',
    medium: 'cartoon-2d' as CharacterMedium,
    personality: '',
    silhouette: '',
    faceNotes: '',
    wardrobe: '',
    palette: '',
    signatureProp: '',
    catchphrase: '',
    description: '',
  });

  const [voiceAxes, setVoiceAxes] = useState<VoiceAxes>(DEFAULT_VOICE_AXES);

  useEffect(() => {
    setCompany(loadCompany());
  }, []);

  const cast = project.characters || [];
  const selected =
    cast.find((c) => c.id === selectedCharId) ||
    company.find((c) => c.id === selectedCharId) ||
    null;

  const activeDna = project.style?.dnaId
    ? getStyleDna(project.style.dnaId)
    : undefined;

  function applyStyleDna(id: StyleDnaId) {
    const pack = getStyleDna(id);
    if (!pack) return;
    onUpdateProject((p) => ({
      ...p,
      style: {
        ...p.style,
        dnaId: pack.id,
        description: buildStyleDescriptionFromDna(pack),
      },
    }));
    toast.success(`Style DNA applied: ${pack.name}`, {
      description: pack.resembles,
    });
    // Nudge medium for kinetic satire
    if (id === 'kinetic-adult-satire') {
      setForge((f) => ({ ...f, medium: 'cartoon-2d' }));
      setPanel('forge');
    }
  }

  function applyArchetype(archId: string) {
    const a = PERSONA_ARCHETYPES.find((x) => x.id === archId);
    if (!a) return;
    setForge((f) => ({
      ...f,
      role: a.role,
      personality: a.personality,
      silhouette: a.silhouette,
      name: f.name || a.label,
    }));
    if (a.forStyle === 'kinetic-adult-satire' && !project.style?.dnaId) {
      applyStyleDna('kinetic-adult-satire');
    }
    toast.message(`Archetype loaded: ${a.label}`);
  }

  function buildFromForge(): Character {
    const baseDesc =
      forge.description.trim() ||
      buildCharacterDescription({
        medium: forge.medium,
        personality: forge.personality,
        silhouette: forge.silhouette,
        faceNotes: forge.faceNotes,
        wardrobe: forge.wardrobe,
        palette: forge.palette,
        signatureProp: forge.signatureProp,
        catchphrase: forge.catchphrase,
      });
    const variants = generateVoiceAlternates(voiceAxes, 5);
    return {
      id: uid(),
      name: forge.name.trim() || 'Unnamed',
      role: forge.role.trim() || 'Supporting',
      description: baseDesc,
      medium: forge.medium,
      personality: forge.personality,
      silhouette: forge.silhouette,
      faceNotes: forge.faceNotes,
      wardrobe: forge.wardrobe,
      palette: forge.palette,
      signatureProp: forge.signatureProp,
      catchphrase: forge.catchphrase,
      voiceAxes,
      voiceVariants: variants,
      activeVoiceId: variants[0]?.id,
      tags: [forge.medium, project.type],
    };
  }

  function addToProject(char: Character) {
    onUpdateProject((p) => ({
      ...p,
      characters: [...(p.characters || []), { ...char, id: char.id || uid() }],
    }));
    setSelectedCharId(char.id);
    toast.success(`${char.name} joined this production`);
  }

  function addToCompany(char: Character) {
    const next = [{ ...char }, ...company.filter((c) => c.id !== char.id)];
    setCompany(next);
    saveCompany(next);
    toast.success(`${char.name} saved to The Company`);
  }

  function forgeAndAdd(alsoCompany: boolean) {
    if (!forge.name.trim()) {
      toast.error('Give them a name');
      return;
    }
    const char = buildFromForge();
    addToProject(char);
    if (alsoCompany) addToCompany(char);
    setPanel('voices');
    setSelectedCharId(char.id);
  }

  function updateChar(charId: string, updates: Partial<Character>) {
    onUpdateProject((p) => ({
      ...p,
      characters: (p.characters || []).map((c) =>
        c.id === charId ? { ...c, ...updates } : c
      ),
    }));
    setCompany((prev) => {
      const next = prev.map((c) => (c.id === charId ? { ...c, ...updates } : c));
      if (prev.some((c) => c.id === charId)) saveCompany(next);
      return next;
    });
  }

  function regenerateVoices(charId: string, axes?: VoiceAxes) {
    const char = cast.find((c) => c.id === charId);
    if (!char) return;
    const variants = generateVoiceAlternates(axes || char.voiceAxes || voiceAxes, 5);
    updateChar(charId, {
      voiceVariants: variants,
      activeVoiceId: variants[0]?.id,
      voiceAxes: axes || char.voiceAxes || voiceAxes,
    });
    toast.success('Voice Lab generated 5 original alternates', {
      description: 'None are celebrity or IP clones — adjacent originals only.',
    });
  }

  const tabs: { id: Panel; label: string }[] = [
    { id: 'dna', label: 'Style DNA' },
    { id: 'forge', label: 'Persona Forge' },
    { id: 'company', label: 'The Company' },
    { id: 'voices', label: 'Voice Lab' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="uppercase text-xs tracking-widest text-[var(--gold)] mb-1">
            ENSEMBLE ATELIER
          </div>
          <div className="font-display text-4xl tracking-tight">Cast · Style · Voice</div>
          <p className="text-sm text-white/55 mt-1 max-w-2xl">
            Build original worlds with Style DNA, forge characters across mediums (2D, 3D, clay…),
            store them in The Company, and invent alternate voices in Voice Lab — never clones of
            real people or existing shows.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setPanel(t.id)}
            className={`px-4 py-2 rounded-full text-sm ${
              panel === t.id
                ? 'bg-[var(--gold)] text-black'
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* STYLE DNA */}
      {panel === 'dna' && (
        <div>
          <div className="mb-4 p-4 rounded-2xl border border-white/10 bg-[#0a0a0a] text-sm text-white/60">
            Want kinetic adult satire with limited-animation energy (the <em>vibe</em> of mid-2000s
            corporate chaos comedies)? Use <strong className="text-white/80">Kinetic Adult Satire</strong> —
            original characters and graphics only. We never copy another show&apos;s cast or look 1:1.
          </div>
          {activeDna && (
            <div className="mb-4 text-xs text-[var(--gold)]">
              Active DNA: {activeDna.name}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {STYLE_DNA_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => applyStyleDna(pack.id)}
                className={`text-left p-4 rounded-2xl border transition ${
                  project.style?.dnaId === pack.id
                    ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                    : 'border-white/10 bg-black/40 hover:border-white/25'
                }`}
              >
                <div className="text-[10px] tracking-widest text-[var(--gold)] mb-1">
                  {pack.eyebrow}
                </div>
                <div className="font-display text-xl mb-1">{pack.name}</div>
                <div className="text-xs text-white/55 mb-2">{pack.tagline}</div>
                <div className="text-[11px] text-white/35 leading-snug">{pack.resembles}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {pack.bestFor.slice(0, 2).map((b) => (
                    <span
                      key={b}
                      className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {project.style?.description && (
            <div className="mt-6 p-4 rounded-2xl border border-white/10 text-xs text-white/50 max-h-40 overflow-y-auto">
              <div className="text-[var(--gold)] mb-1">Injected into every generation</div>
              {project.style.description}
            </div>
          )}
        </div>
      )}

      {/* PERSONA FORGE */}
      {panel === 'forge' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Quick archetypes
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {PERSONA_ARCHETYPES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => applyArchetype(a.id)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/60 hover:border-[var(--gold)]/40"
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Field label="Name *">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.name}
                  onChange={(e) => setForge({ ...forge, name: e.target.value })}
                  placeholder="e.g. Rex Caliber"
                />
              </Field>
              <Field label="Role">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.role}
                  onChange={(e) => setForge({ ...forge, role: e.target.value })}
                />
              </Field>
              <Field label="Medium">
                <div className="grid grid-cols-2 gap-2">
                  {CHARACTER_MEDIUMS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForge({ ...forge, medium: m.id })}
                      className={`text-left p-2 rounded-xl border text-xs ${
                        forge.medium === m.id
                          ? 'border-[var(--gold)] text-white'
                          : 'border-white/10 text-white/50'
                      }`}
                    >
                      <div className="font-medium">{m.label}</div>
                      <div className="text-[10px] opacity-60">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Personality">
                <textarea
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm min-h-[60px]"
                  value={forge.personality}
                  onChange={(e) => setForge({ ...forge, personality: e.target.value })}
                  placeholder="Smug visionary who brands every failure as a pivot"
                />
              </Field>
              <Field label="Silhouette">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.silhouette}
                  onChange={(e) => setForge({ ...forge, silhouette: e.target.value })}
                  placeholder="Tall sharp shoulders, iconic hair wedge"
                />
              </Field>
              <Field label="Face notes">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.faceNotes}
                  onChange={(e) => setForge({ ...forge, faceNotes: e.target.value })}
                  placeholder="Heavy lidded eyes, permanent smirk"
                />
              </Field>
              <Field label="Wardrobe">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.wardrobe}
                  onChange={(e) => setForge({ ...forge, wardrobe: e.target.value })}
                  placeholder="Charcoal suit, open collar, one ridiculous pin"
                />
              </Field>
              <Field label="Palette">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.palette}
                  onChange={(e) => setForge({ ...forge, palette: e.target.value })}
                  placeholder="Slate, crimson accent, cold white"
                />
              </Field>
              <Field label="Signature prop">
                <input
                  className="w-full p-2.5 rounded-xl bg-black border border-white/10 text-sm"
                  value={forge.signatureProp}
                  onChange={(e) => setForge({ ...forge, signatureProp: e.target.value })}
                  placeholder="Laser pointer that never works"
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => forgeAndAdd(false)}
                className="btn-gold px-5 py-2.5 rounded-2xl text-black text-sm"
              >
                Add to this project
              </button>
              <button
                onClick={() => forgeAndAdd(true)}
                className="btn-outline px-5 py-2.5 rounded-2xl text-sm"
              >
                Add + save to The Company
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Seed Voice Lab axes
            </div>
            <p className="text-xs text-white/45 mb-3">
              These axes shape <em>alternate original</em> voices — not impressions.
            </p>
            {(
              [
                ['pitch', 'Pitch (low → high)'],
                ['energy', 'Energy'],
                ['texture', 'Texture (smooth → gravel)'],
                ['pace', 'Pace'],
                ['attitude', 'Attitude (warm → smug)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="mb-3">
                <div className="flex justify-between text-[11px] text-white/45 mb-1">
                  <span>{label}</span>
                  <span>{voiceAxes[key]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={voiceAxes[key]}
                  onChange={(e) =>
                    setVoiceAxes({ ...voiceAxes, [key]: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            ))}
            <div className="text-xs text-white/50 p-3 rounded-xl bg-white/5">
              Preview: {describeAxes(voiceAxes)}
            </div>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                Satire voice presets
              </div>
              <div className="flex flex-wrap gap-2">
                {SATIRE_VOICE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setVoiceAxes(p.axes);
                      toast.message(p.label, { description: p.note });
                    }}
                    className="text-[11px] px-3 py-1 rounded-full border border-white/15 text-white/55"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THE COMPANY */}
      {panel === 'company' && (
        <div>
          <p className="text-sm text-white/55 mb-4">
            <strong className="text-white/80">The Company</strong> is your repertory cast — reusable
            across projects (stored on this device). Pull someone into the current production anytime.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
                This production ({cast.length})
              </div>
              {cast.length === 0 && (
                <div className="text-white/40 text-sm border border-white/10 rounded-2xl p-6">
                  No cast yet — forge a persona or pull from The Company.
                </div>
              )}
              <div className="space-y-2">
                {cast.map((c) => (
                  <CharRow
                    key={c.id}
                    c={c}
                    active={selectedCharId === c.id}
                    onSelect={() => setSelectedCharId(c.id)}
                    actions={
                      <>
                        <button
                          className="text-[10px] underline text-white/40"
                          onClick={() => addToCompany(c)}
                        >
                          Save to Company
                        </button>
                        {onGenerateRef && (
                          <button
                            className="text-[10px] underline text-[var(--gold)]"
                            onClick={() => onGenerateRef(c.id)}
                          >
                            Gen ref
                          </button>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
                The Company library ({company.length})
              </div>
              {company.length === 0 && (
                <div className="text-white/40 text-sm border border-white/10 rounded-2xl p-6">
                  Empty company. Forge characters and &quot;Add + save to The Company&quot;.
                </div>
              )}
              <div className="space-y-2">
                {company.map((c) => (
                  <CharRow
                    key={c.id}
                    c={c}
                    active={selectedCharId === c.id}
                    onSelect={() => setSelectedCharId(c.id)}
                    actions={
                      <button
                        className="text-[10px] underline text-[var(--gold)]"
                        onClick={() => addToProject({ ...c, id: uid() })}
                      >
                        Add to project
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VOICE LAB */}
      {panel === 'voices' && (
        <div>
          <div className="mb-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-xs text-white/60">
            <strong className="text-amber-200/90">Voice Lab policy:</strong> generates{' '}
            <em>alternate original</em> vocal textures from axes. It will not clone celebrities,
            cartoon stars, or any existing show&apos;s cast. Perfect for funky, deadpan, or hype
            energy in the same family as your Style DNA.
          </div>

          {cast.length === 0 ? (
            <div className="text-white/50 text-sm">Add characters first (Persona Forge).</div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                {cast.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCharId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border text-sm ${
                      selectedCharId === c.id
                        ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-white/45">{c.role}</div>
                  </button>
                ))}
              </div>
              <div className="lg:col-span-2">
                {selected && cast.some((c) => c.id === selected.id) ? (
                  <div>
                    <div className="font-display text-2xl mb-1">{selected.name}</div>
                    <div className="text-xs text-white/45 mb-4">
                      Active: {selected.voiceVariants?.find((v) => v.id === selected.activeVoiceId)?.name || '—'}
                    </div>
                    <button
                      onClick={() => regenerateVoices(selected.id, selected.voiceAxes || voiceAxes)}
                      className="btn-gold text-black text-sm px-5 py-2 rounded-2xl mb-4"
                    >
                      Generate 5 alternate originals
                    </button>
                    <div className="space-y-2">
                      {(selected.voiceVariants || []).map((v) => (
                        <button
                          key={v.id}
                          onClick={() => updateChar(selected.id, { activeVoiceId: v.id })}
                          className={`w-full text-left p-3 rounded-xl border ${
                            selected.activeVoiceId === v.id
                              ? 'border-[var(--gold)]'
                              : 'border-white/10'
                          }`}
                        >
                          <div className="text-sm font-medium">{v.name}</div>
                          <div className="text-[11px] text-white/50 mt-1">{v.brief}</div>
                        </button>
                      ))}
                    </div>
                    {!selected.voiceVariants?.length && (
                      <p className="text-sm text-white/45">
                        No variants yet — generate alternates for this character.
                      </p>
                    )}
                    <p className="text-[11px] text-white/35 mt-4">
                      Active voice injects into video prompts as performance direction. Future: TTS
                      will use the same briefs.
                    </p>
                  </div>
                ) : (
                  <div className="text-white/45 text-sm">Select a cast member on this project.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/45 mb-1">{label}</div>
      {children}
    </div>
  );
}

function CharRow({
  c,
  active,
  onSelect,
  actions,
}: {
  c: Character;
  active?: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
        active ? 'border-[var(--gold)]/50 bg-[var(--gold)]/5' : 'border-white/10'
      }`}
    >
      <button type="button" onClick={onSelect} className="text-left flex-1">
        <div className="text-sm font-medium">{c.name}</div>
        <div className="text-[11px] text-white/45">
          {c.role}
          {c.medium ? ` · ${c.medium}` : ''}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1">{actions}</div>
    </div>
  );
}
