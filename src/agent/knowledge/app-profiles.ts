/**
 * Curated per-app operating notes (preset profiles).
 *
 * Generic vision treats every app the same; these notes teach the agent how a
 * specific app works (navigation, save flow, quirks) so first-attempt accuracy
 * jumps on software we already know. Unknown apps get no profile — a future
 * research mode will learn and persist those automatically.
 *
 * Selection is by focused-window title substring (see matchAppProfile); notes
 * are injected into decide() history next to the focused-window line. Keep
 * every note short: the whole block rides on every decision for that app.
 */

export interface AppProfile {
  readonly id: string;
  /** Lowercase title substrings. First profile with any hit wins. */
  readonly match: readonly string[];
  /** Operating notes, injected verbatim. Keep under 600 characters. */
  readonly notes: string;
}

const TALLY_NOTES = [
  'Legacy Tally-style voucher screen: drive by keyboard, not mouse.',
  'Tab/Enter move between fields; type values directly into the focused field.',
  'Replace a field with Ctrl+A first, then type the new value.',
  'Save via the on-screen Accept/Save control; read totals off the screen before finishing.',
].join(' ');

const CALC_NOTES = [
  'LibreOffice Calc grid: click a cell, type, Tab moves right, Enter moves down, Home jumps to column A of the row.',
  'Save with Ctrl+S; the filename field may be prefilled — Ctrl+A first, then type.',
  'If a save may already have worked, verify with run_shell (ls the folder) instead of saving again.',
  'Bulk entry: when history shows Next chunk, select those rows once via the Name Box (click it, type the START:END range for this chunk, Enter), then type the whole chunk in ONE type action with Tab between every cell - never type the range address into a grid cell.',
].join(' ');

const WRITER_NOTES = [
  'LibreOffice Writer document: click the page and type; Enter is a new paragraph.',
  'Save with Ctrl+S; the filename field may be prefilled — Ctrl+A first, then type.',
  'If a save may already have worked, verify with run_shell (ls the folder) instead of saving again.',
].join(' ');

export const APP_PROFILES: readonly AppProfile[] = [
  { id: 'tally', match: ['tally'], notes: TALLY_NOTES },
  { id: 'calc', match: ['libreoffice calc', 'calc'], notes: CALC_NOTES },
  { id: 'writer', match: ['libreoffice writer', 'writer'], notes: WRITER_NOTES },
];

/** Finds the profile for a focused window title. Null when the app is unknown. */
export function matchAppProfile(windowTitle: string | null | undefined): AppProfile | null {
  if (!windowTitle) return null;
  const title = windowTitle.toLowerCase();
  return APP_PROFILES.find(profile => profile.match.some(keyword => title.includes(keyword))) ?? null;
}
