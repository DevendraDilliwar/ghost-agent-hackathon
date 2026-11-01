import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';
import type { UserHandoff } from '../shared/contracts/task';

export interface DesktopPort {
  preflight(signal: AbortSignal): Promise<void>;
  capture(signal: AbortSignal): Promise<ScreenObservation>;
  execute(action: DesktopCommand, observation: ScreenObservation, signal: AbortSignal): Promise<void>;
}

export interface ModelDecision {
  readonly action: DesktopCommand | null;
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
  decide(input: {
    goal: string;
    observation: ScreenObservation;
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
    observation: ScreenObservation;
    signal: AbortSignal;
  }): Promise<VerifyDecision>;
}
