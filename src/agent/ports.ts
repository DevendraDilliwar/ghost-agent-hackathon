import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';
import type { UserHandoff } from '../shared/contracts/task';

export interface DesktopPort {
  preflight(signal: AbortSignal): Promise<void>;
  capture(signal: AbortSignal): Promise<ScreenObservation>;
  execute(action: DesktopCommand, observation: ScreenObservation, signal: AbortSignal): Promise<void>;
  /** Visible windows for stall recovery. Absent in tests and minimal hosts. */
  listWindows?(signal: AbortSignal): Promise<import('../shared/contracts/desktop').DesktopWindow[]>;
}

export interface ShellCall {
  readonly command: string;
}

export interface ShellResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface ShellPort {
  run(command: string, signal: AbortSignal): Promise<ShellResult>;
}

export interface ModelDecision {
  readonly action: DesktopCommand | null;
  /** Follow-up actions from the same screenshot. Absent or empty means single-step. */
  readonly actions?: DesktopCommand[];
  /** Terminal command to run instead of a desktop action. Never combined with action. */
  readonly shell?: ShellCall;
  /** Grounded tag to click instead of coordinates. The adapter resolves it to a click; never combined with action. */
  readonly tag?: number;
  /** Computer actions returned without a screenshot (text mode). The controller captures fresh, then validates. */
  readonly pendingActions?: unknown[];
  readonly message: string;
  readonly warnings: string[];
  readonly pendingSafetyChecks?: import('../shared/contracts/task').PendingSafetyCheck[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly handoff?: UserHandoff;
}

export interface IntentDecision {
  readonly intent: import('../shared/contracts/task').ParsedIntent;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface VerifyDecision {
  readonly confirmed: boolean;
  readonly detail: string;
  /** One-based planned steps visibly complete. Absent when the audit was skipped. */
  readonly doneSteps?: number[];
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface TypedVerifyDecision extends VerifyDecision {
  readonly observedText: string | null;
  readonly destinationConfirmed: boolean;
  /** Complete expected rows seen at the intended destination, never estimated from keystrokes. */
  readonly verifiedRows: number;
}

export interface PlanDecision {
  readonly phases: Array<{
    readonly domain: import('../shared/contracts/mission').DomainId;
    readonly goal: string;
    readonly steps: string[];
    readonly success: string;
  }>;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface SourceDecision {
  readonly text: string;
  readonly lowConfidence: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ExtractDecision {
  readonly billNo: string;
  readonly date: string;
  readonly total: string;
  readonly items: ReadonlyArray<{ readonly name: string; readonly qty: string; readonly price: string }>;
  /** Free-form gaps the model could not find (e.g. "row 3 price"). Empty when complete. */
  readonly missing: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Ordered fill list for row-by-row entry tasks. Empty units = not an entry task. */
export interface FillPlanDecision {
  /** Optional headers row. */
  readonly headers?: ReadonlyArray<string>;
  /** One unit per row, cells left-to-right. At most 200 units, 10 cells each. */
  readonly units: ReadonlyArray<{ readonly cells: ReadonlyArray<string> }>;
  /** Rows to type per round (1-10). */
  readonly chunkRows: number;
  /** Where typing should begin (e.g. "first empty row"). May be empty. */
  readonly startHint: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Typed text matches when words match: grid Tab separators in bulk chunks
 * and the model's own spacing of read-back text must not fail verification
 * by themselves. Real typos (different words) still fail.
 */
export function sameTypedText(observed: string | null, expected: string): boolean {
  if (observed === null) return false;
  const squash = (value: string): string => value.trim().replace(/\s+/g, ' ');
  return squash(observed) === squash(expected);
}

/** Local text recognition. Rejects when OCR is unavailable. */
export interface OcrPort {
  readText(image: string, signal: AbortSignal): Promise<string>;
}

/** Durable skill persistence. Load misses yield [] and saves fail silently. */
export interface SkillStorePort {
  load(): Promise<unknown>;
  save(skills: readonly import('./memory/skill-memory').SkillRecord[]): Promise<void>;
}

/** Durable cross-task memory. Load misses yield [] and saves fail silently. */
export interface MemoryStorePort {
  load(): Promise<unknown>;
  save(records: readonly import('./memory/cross-task-memory').MistakeRecord[]): Promise<void>;
}

/** Durable mission persistence. Implementations must never throw: load misses
 *  yield null/[] and saves fail silently so runs continue without checkpoints. */
export interface CheckpointPort {
  saveMission(meta: import('../shared/contracts/mission').MissionMeta): Promise<void>;
  loadMission(missionId: string): Promise<import('../shared/contracts/mission').MissionMeta | null>;
  save(checkpoint: import('../shared/contracts/mission').PhaseCheckpoint): Promise<void>;
  list(missionId: string): Promise<Array<import('../shared/contracts/mission').PhaseCheckpoint>>;
  listMissions(): Promise<Array<import('../shared/contracts/mission').MissionSummary>>;
}

/** Durable chat-attachment persistence for photo-to-entry runs. Pruning stays runtime-side. */
export interface SourceStorePort {
  saveSource(runId: string, files: readonly import('../shared/contracts/task').RunAttachmentInput[]): Promise<readonly import('../shared/contracts/task').StoredAttachment[]>;
}

export interface ModelPort {
  /**
   * Asks the model for the next step. Implementations SHOULD flag malformed
   * model output (bad tool-call shape — not transport/auth/limit failures)
   * with `malformedModelOutput: true` on the thrown error, so the controller
   * retries once with correction guidance instead of failing the run.
   */
  decide(input: {
    goal: string;
    /** Absent after a terminal command: the model decides from text output, no screenshot. */
    observation?: ScreenObservation;
    history: string[];
    signal: AbortSignal;
    grounding?: import('../shared/contracts/grounding').GroundingResult;
  }): Promise<ModelDecision>;
  parseIntent(input: {
    goal: string;
    clarifications: string[];
    /** Attached image names (never the bytes). Omit when the run has no attachments. */
    attachments?: string[];
    signal: AbortSignal;
  }): Promise<IntentDecision>;
  plan(input: {
    goal: string;
    /** Replan context: failures and remaining work. Absent for the first plan. */
    context?: string;
    /** Resolved intent parameters (e.g. component, file_name, columns, row_count). */
    params?: Record<string, string>;
    clarifications?: string[];
    /** Attached image names (never the bytes). Omit when the run has no attachments. */
    attachments?: string[];
    signal: AbortSignal;
  }): Promise<PlanDecision>;
  readSource(input: {
    image: string;
    signal: AbortSignal;
  }): Promise<SourceDecision>;
  extractFields(input: {
    transcript: string;
    signal: AbortSignal;
  }): Promise<ExtractDecision>;
  fillPlan(input: {
    goal: string;
    /** Intent summary; empty when intent is missing. */
    summary: string;
    /** Resolved intent parameters (e.g. columns, row_count, file_name). */
    params?: Record<string, string>;
    clarifications?: string[];
    /** Extracted data one-liner for photo runs; empty for prompt-data runs. */
    data: string;
    signal: AbortSignal;
  }): Promise<FillPlanDecision>;
  verifyText(input: {
    text: string;
    before: ScreenObservation;
    destination: string;
    expectedRows: readonly (readonly string[])[];
    observation: ScreenObservation;
    signal: AbortSignal;
  }): Promise<TypedVerifyDecision>;
  verifySuccess(input: {
    condition: string;
    /** Numbered planned steps for the completion audit. Omit when the phase has none. */
    steps?: string[];
    /** Recent executed shell commands with their outputs, newest last. Omit when the phase used no shell. */
    transcript?: string[];
    observation: ScreenObservation;
    signal: AbortSignal;
  }): Promise<VerifyDecision>;
}
