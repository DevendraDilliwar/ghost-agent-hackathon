import type { AgentStatus } from '../../../../shared/contracts/task';

export const statusLabels: Record<AgentStatus, string> = {
  idle: 'Ready for a task', preparing: 'Checking your desktop', observing: 'Looking at the screen',
  thinking: 'Choosing the next step', validating: 'Checking the next step', awaiting_approval: 'Review the next action',
  acting: 'Working on your task', verifying: 'Check the result', completed: 'Result confirmed',
  paused: 'Paused', needs_user: 'Your help is needed', stopped: 'Task stopped', failed: 'Task needs attention',
};

export function isActiveTask(status: AgentStatus): boolean {
  return !['idle', 'completed', 'stopped', 'failed'].includes(status);
}
