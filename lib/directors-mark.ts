/**
 * Director's Mark — personal studio signature (visual + optional audio sting).
 * Stored per-user (profile) and insertable at project start.
 */

export type DirectorsMark = {
  /** Short display name e.g. "RIVERA / MD" */
  label: string;
  /** Optional logo / end card image URL */
  visualUrl?: string;
  /** Optional short audio sting URL */
  audioUrl?: string;
  /** On-screen treatment notes for gen */
  treatment?: string;
  /** When true, auto-prepend a title/mark beat on new projects */
  autoInsertOnNewProjects?: boolean;
  updatedAt?: string;
};

const LS_KEY = 'moviedirector_directors_mark';

export function loadDirectorsMarkLocal(): DirectorsMark | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DirectorsMark;
  } catch {
    return null;
  }
}

export function saveDirectorsMarkLocal(mark: DirectorsMark) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({ ...mark, updatedAt: new Date().toISOString() })
  );
}

/** Build a 2–4s opening title beat description for the shot list */
export function directorsMarkShotDescription(mark: DirectorsMark, projectTitle: string): string {
  return [
    `DIRECTOR'S MARK title card for "${projectTitle}".`,
    mark.label && `Signature: ${mark.label}.`,
    mark.treatment || 'Clean cinematic studio identity card, confident, short hold.',
    mark.visualUrl && 'Use the locked director mark visual as the logo plate.',
    'No dialogue. Fade or hard cut into the cold open.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function emptyDirectorsMark(): DirectorsMark {
  return {
    label: '',
    treatment: 'Minimal gold-on-black studio card, 2 seconds, film grain.',
    autoInsertOnNewProjects: true,
  };
}
