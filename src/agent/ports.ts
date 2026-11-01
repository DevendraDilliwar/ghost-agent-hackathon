import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';
import type { UserHandoff } from '../shared/contracts/task';

export interface DesktopPort {
  preflight(signal: AbortSignal): Promise<void>;
  capture(signal: AbortSignal): Promise<ScreenObservation>;
  execute(action: DesktopCommand, observation: ScreenObservation, signal: AbortSignal): Promise<void>;
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

/** Durable mission persistence. Implementations must never throw: load misses
 *  yield null/[] and saves fail silently so runs continue without checkpoints. */
export interface CheckpointPort {
  saveMission(meta: import('../shared/contracts/mission').MissionMeta): Promise<void>;
  loadMission(missionId: string): Promise<import('../shared/contracts/mission').MissionMeta | null>;
  save(checkpoint: import('../shared/contracts/mission').PhaseCheckpoint): Promise<void>;
  list(missionId: string): Promise<Array<import('../shared/contracts/mission').PhaseCheckpoint>>;
  listMissions(): Promise<Array<import('../shared/contracts/mission').MissionSummary>>;
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
    signal: AbortSignal;
  }): Promise<IntentDecision>;
  plan(input: {
    goal: string;
    signal: AbortSignal;
  }): Promise<PlanDecision>;
  verifyText(input: {
    text: string;
    observation: ScreenObservation;
    signal: AbortSignal;
  }): Promise<VerifyDecision>;
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
