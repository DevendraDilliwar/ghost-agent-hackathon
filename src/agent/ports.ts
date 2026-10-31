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
  verifyText(input: {
    text: string;
    observation: ScreenObservation;
    signal: AbortSignal;
  }): Promise<VerifyDecision>;
}
