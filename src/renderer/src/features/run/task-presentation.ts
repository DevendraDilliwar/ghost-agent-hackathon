import type { AgentStatus, TaskSnapshot } from '../../../../shared/contracts/task';
import type { RunRecord } from '../../../../shared/contracts/history';

type StatusTone = 'active' | 'done' | 'failed' | 'muted';

export function statusTone(status: AgentStatus): StatusTone {
  if (status === 'completed') return 'done';
  if (status === 'failed') return 'failed';
  if (status === 'idle' || status === 'stopped') return 'muted';
  return 'active';
}

/** Shape a stored run as a view-only snapshot for the thread UI. */
export function toViewSnapshot(record: RunRecord): TaskSnapshot {
  return {
    runId: record.runId, revision: 0, status: record.status,
    goal: record.goal || 'Untitled task', maxSteps: record.maxSteps, maxMinutes: record.maxMinutes,
    actions: [...record.actions], messages: [...record.messages],
    screenshot: null, pendingActionId: null, message: record.message,
    awaitingCompletion: false, handoff: null, inputTokens: record.inputTokens, outputTokens: record.outputTokens,
    intent: null, mission: record.mission,
  };
}

export const statusLabels: Record<AgentStatus, string> = {
  idle: 'Ready for a task', preparing: 'Checking your desktop', observing: 'Looking at the screen',
  thinking: 'Choosing the next step', validating: 'Checking the next step', awaiting_approval: 'Review the next action',
  acting: 'Working on your task', verifying: 'Check the result', completed: 'Result confirmed',
  paused: 'Paused', needs_user: 'Your help is needed', stopped: 'Task stopped', failed: 'Task needs attention',
};

export function isActiveTask(status: AgentStatus): boolean {
  return !['idle', 'completed', 'stopped', 'failed'].includes(status);
}

export type BudgetPresetId = 'small' | 'large' | 'max';

export interface BudgetPreset {
  readonly id: BudgetPresetId;
  readonly label: string;
  readonly hint: string;
  readonly maxSteps: number;
  readonly maxMinutes: number;
}

export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  { id: 'small', label: 'Small', hint: '10 steps · 3 min', maxSteps: 10, maxMinutes: 3 },
  { id: 'large', label: 'Large', hint: '25 steps · 8 min', maxSteps: 25, maxMinutes: 8 },
  { id: 'max', label: 'Max', hint: '60 steps · 20 min', maxSteps: 60, maxMinutes: 20 },
];

/** Matches custom slider values back to a preset, or null when bespoke. */
export function matchBudgetPreset(maxSteps: number, maxMinutes: number): BudgetPresetId | null {
  return BUDGET_PRESETS.find(preset => preset.maxSteps === maxSteps && preset.maxMinutes === maxMinutes)?.id ?? null;
}
