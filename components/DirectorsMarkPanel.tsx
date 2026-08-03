'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Project, Shot } from '@/lib/types';
import {
  type DirectorsMark,
  directorsMarkShotDescription,
  emptyDirectorsMark,
  loadDirectorsMarkLocal,
  saveDirectorsMarkLocal,
} from '@/lib/directors-mark';

type Props = {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
};

export default function DirectorsMarkPanel({ project, onUpdate }: Props) {
  const [mark, setMark] = useState<DirectorsMark>(emptyDirectorsMark());

  useEffect(() => {
    const saved = loadDirectorsMarkLocal();
    if (saved) setMark({ ...emptyDirectorsMark(), ...saved });
  }, []);

  function save() {
    if (!mark.label.trim()) {
      toast.error('Add a short signature label (e.g. your name or studio)');
      return;
    }
    saveDirectorsMarkLocal(mark);
    toast.success('Director’s Mark saved', {
      description: 'Insert it as shot #1 on any project when you’re ready.',
    });
  }

  function insertIntoProject() {
    if (!mark.label.trim()) {
      toast.error('Save a label first');
      return;
    }
    saveDirectorsMarkLocal(mark);
    const id = `mark-${Math.random().toString(36).slice(2, 9)}`;
    const markShot: Shot = {
      id,
      number: 1,
      description: directorsMarkShotDescription(mark, project.title),
      camera: 'Title card / locked off',
      duration: 3,
      emotion: 'Identity',
      styleNotes: mark.treatment,
      imageUrl: mark.visualUrl,
      voiceAudioUrl: mark.audioUrl,
      shotKind: 'story',
    };
    onUpdate((p) => {
      const rest = (p.shots || []).map((s, i) => ({
        ...s,
        number: i + 2,
      }));
      return {
        ...p,
        directorsMarkInserted: true,
        shots: [markShot, ...rest],
      };
    });
    toast.success('Director’s Mark inserted as shot #1', {
      description: 'Generate the title card frame when ready — then the cold open.',
    });
  }

  return (
    <div className="director-card p-5 rounded-3xl space-y-4 max-w-xl">
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--gold)] mb-1">
          Director’s Mark · studio identity
        </div>
        <div className="font-display text-2xl tracking-tight">Your signature</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Create once. Insert at the start of every project — visual mark + optional audio sting.
          This is your personal studio badge.
        </p>
      </div>

      <input
        className="director-input w-full p-2 rounded-xl text-sm"
        placeholder="Label e.g. RIVERA PICTURES"
        value={mark.label}
        onChange={(e) => setMark({ ...mark, label: e.target.value })}
      />
      <input
        className="director-input w-full p-2 rounded-xl text-sm"
        placeholder="Visual mark URL (logo / end card — optional)"
        value={mark.visualUrl || ''}
        onChange={(e) => setMark({ ...mark, visualUrl: e.target.value })}
      />
      <input
        className="director-input w-full p-2 rounded-xl text-sm"
        placeholder="Audio sting URL (optional)"
        value={mark.audioUrl || ''}
        onChange={(e) => setMark({ ...mark, audioUrl: e.target.value })}
      />
      <textarea
        className="director-input w-full p-2 rounded-xl text-sm min-h-[70px]"
        placeholder="Treatment — how the mark should look on screen"
        value={mark.treatment || ''}
        onChange={(e) => setMark({ ...mark, treatment: e.target.value })}
      />
      <label className="flex items-center gap-2 text-xs text-white/50">
        <input
          type="checkbox"
          checked={!!mark.autoInsertOnNewProjects}
          onChange={(e) => setMark({ ...mark, autoInsertOnNewProjects: e.target.checked })}
        />
        Remember to offer insert on new projects
      </label>

      {mark.visualUrl && (
        <img
          src={mark.visualUrl}
          alt="Mark preview"
          className="max-h-24 rounded-xl border border-white/10"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="btn-outline text-sm px-4 py-2 rounded-xl">
          Save mark
        </button>
        <button
          type="button"
          onClick={insertIntoProject}
          className="btn-gold text-black text-sm px-4 py-2 rounded-xl"
        >
          Insert as shot #1
        </button>
      </div>
    </div>
  );
}
