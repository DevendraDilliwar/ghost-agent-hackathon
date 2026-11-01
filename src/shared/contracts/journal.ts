/**
 * Redacted run journal — shared event contract.
 *
 * The journal is the agent's durable memory of what happened. Every event is
 * redacted BY CONSTRUCTION: IDs, timestamps, stages, outcomes, durations and
 * token counts only. Screenshot bytes, typed text, keys and passwords must
 * never reach a JournalEvent — use describeCommand-style summaries instead.
 *
 * Lives in shared so the agent layer can emit events without importing the
 * node-backed journal writers in observability.
 */

export type JournalStage =
  | 'mission'
  | 'intent'
  | 'decide'
  | 'verify'
  | 'stall'
  | 'handoff'
  | 'terminal';

export type JournalOutcome =
  | 'success'
  | 'failure'
  | 'stalled'
  | 'handoff'
  | 'info';

export interface JournalEvent {
  /** Mission grouping id. Until P2 resume lands, missionId === runId. */
  readonly missionId: string;
  readonly runId: string;
  /** Owning phase once P1 phase tracking is wired; null until then. */
  readonly phaseId: string | null;
  readonly stepId: string | null;
  readonly ts: number;
  readonly stage: JournalStage;
  readonly outcome: JournalOutcome;
  /** Redacted one-line summary, max 500 chars, no image bytes. */
  readonly summary: string;
  readonly durationMs?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** Sink side of the journal: fire-and-forget, must never throw. */
export interface JournalSink {
  append(event: JournalEvent): void;
}

const imagePattern = /data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g;
const nul = String.fromCharCode(0);

/**
 * Redacts free text for the journal: strips embedded image data URLs and NUL
 * characters, then truncates. Callers must still pass pre-redacted summaries
 * (never raw typed text or secrets) — this is the safety net.
 */
export function redactSummary(text: string, max = 500): string {
  return String(text ?? '')
    .replace(imagePattern, '[image]')
    .split(nul).join('')
    .trim()
    .slice(0, max);
}

export function createJournalEvent(input: {
  missionId: string;
  runId: string;
  phaseId?: string | null;
  stepId?: string | null;
  stage: JournalStage;
  outcome: JournalOutcome;
  summary: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  ts?: number;
}): JournalEvent {
  return {
    missionId: input.missionId,
    runId: input.runId,
    phaseId: input.phaseId ?? null,
    stepId: input.stepId ?? null,
    ts: input.ts ?? Date.now(),
    stage: input.stage,
    outcome: input.outcome,
    summary: redactSummary(input.summary),
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(input.inputTokens === undefined ? {} : { inputTokens: input.inputTokens }),
    ...(input.outputTokens === undefined ? {} : { outputTokens: input.outputTokens }),
  };
}
