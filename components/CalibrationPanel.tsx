'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import type { CalibrationIssue, CalibrationReport } from '@/lib/calibration-engine';
import { buildCalibrationFixPrompt } from '@/lib/calibration-engine';

type Props = {
  project: Project;
  token: string | null;
  onUpdate: (updater: (p: Project) => Project) => void;
  onAuthRequired?: () => void;
  onGenerateFrame?: (shotId: string) => void;
  onJumpToShot?: (shotId: string) => void;
};

export default function CalibrationPanel({
  project,
  token,
  onUpdate,
  onAuthRequired,
  onGenerateFrame,
  onJumpToShot,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CalibrationReport | null>(
    (project.calibrationReport as CalibrationReport | undefined) || null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function runScan() {
    if (!token) {
      onAuthRequired?.();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/generate/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Calibration failed');
      const r = data.report as CalibrationReport;
      setReport(r);
      onUpdate((p) => ({
        ...p,
        calibrationReport: {
          scannedAt: r.scannedAt,
          issueCount: r.issueCount,
          summary: r.summary,
          issues: r.issues as unknown as Array<Record<string, unknown>>,
        },
      }));
      toast.success(r.issueCount ? `Found ${r.issueCount} flag(s)` : 'Sequence looks clean', {
        description: r.summary,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Calibration failed');
    } finally {
      setBusy(false);
    }
  }

  function copyFixBrief(issue: CalibrationIssue) {
    const shot = (project.shots || []).find((s) => s.id === issue.shotId);
    if (!shot) return;
    const prompt = buildCalibrationFixPrompt(project, issue, shot);
    navigator.clipboard.writeText(prompt).catch(() => {});
    toast.success('Fix brief copied — generate frame/video on that shot when ready');
  }

  const selected = report?.issues.find((i) => i.id === selectedId) || null;

  return (
    <div className="director-card p-5 rounded-3xl space-y-4 max-w-3xl">
      <div>
        <div className="text-[10px] tracking-[3px] uppercase text-[var(--cyan)] mb-1">
          Calibration engine · continuity QC
        </div>
        <div className="font-display text-2xl tracking-tight">Scan the sequence</div>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          Flags position jumps, energy mismatches, dialogue/voice gaps, set breaks, and cast swaps.
          You stay in control — pick a flag, then regen or bridge. Free structural pass.
        </p>
      </div>

      <button
        type="button"
        onClick={runScan}
        disabled={busy}
        className="btn-gold text-black text-sm px-5 py-2 rounded-xl disabled:opacity-40"
      >
        {busy ? 'Scanning…' : 'Run calibration scan'}
      </button>

      {report && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <p className="text-sm text-white/70">{report.summary}</p>
          <div className="text-[10px] text-white/40">
            Scanned {new Date(report.scannedAt).toLocaleString()}
          </div>
          {report.issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => {
                setSelectedId(issue.id);
                onJumpToShot?.(issue.shotId);
              }}
              className={`w-full text-left p-3 rounded-xl border ${
                selectedId === issue.id
                  ? 'border-[var(--gold)]/50 bg-[var(--gold)]/10'
                  : 'border-white/10 bg-black/40'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                    issue.severity === 'critical'
                      ? 'bg-red-500/30 text-red-200'
                      : issue.severity === 'warn'
                        ? 'bg-amber-400/20 text-amber-100'
                        : 'bg-white/10 text-white/50'
                  }`}
                >
                  {issue.severity}
                </span>
                <span className="text-[10px] text-white/40">#{issue.shotNumber}</span>
                <span className="text-[10px] text-white/35">{issue.kind}</span>
              </div>
              <div className="font-medium text-sm mt-1">{issue.title}</div>
              <div className="text-[11px] text-white/55 mt-0.5">{issue.detail}</div>
            </button>
          ))}

          {selected && (
            <div className="p-4 rounded-2xl border border-[var(--cyan)]/30 bg-[var(--cyan)]/5 space-y-2">
              <div className="text-[10px] uppercase text-[var(--cyan)]">Selected flag</div>
              <p className="text-sm text-white/80">{selected.fixBrief}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs px-3 py-1.5 rounded-xl"
                  onClick={() => copyFixBrief(selected)}
                >
                  Copy fix prompt
                </button>
                {onGenerateFrame && (
                  <button
                    type="button"
                    className="btn-gold text-black text-xs px-3 py-1.5 rounded-xl"
                    onClick={() => onGenerateFrame(selected.shotId)}
                  >
                    Regen frame for #{selected.shotNumber}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
