import type { AgentStatus, TaskSnapshot } from '../../../../shared/contracts/task';
import type { RunRecord } from '../../../../shared/contracts/history';

export type StatusTone = 'active' | 'done' | 'failed' | 'muted';

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
