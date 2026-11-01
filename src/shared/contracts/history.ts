/**
 * Run history contract — durable local record of every chat/task thread.
 * Redacted like checkpoints: no screenshots, no typed text, no coordinates.
 */
import type { AgentAction, AgentStatus, ChatMessage } from './task';
import type { MissionPlan } from './mission';

export interface RunSummary {
  readonly runId: string;
  readonly goal: string;
  readonly status: AgentStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly missionId: string | null;
  readonly resumable: boolean;
}

export interface RunRecord extends RunSummary {
  readonly maxSteps: number;
  readonly maxMinutes: number;
  readonly message: string;
  readonly messages: ChatMessage[];
  readonly actions: AgentAction[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly mission: MissionPlan | null;
}
