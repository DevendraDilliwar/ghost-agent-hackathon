import type { ControlsSnapshot } from '../../shared/contracts/controls';
import type { TaskSnapshot } from '../../shared/contracts/task';

export function controlsSnapshot(task: TaskSnapshot, emergencyStopShortcut: string | null): ControlsSnapshot {
  return { runId: task.runId, revision: task.revision, status: task.status,
    executed: task.actions.filter(action => action.status === 'executed').length, maxSteps: task.maxSteps,
    canResume: task.status === 'paused' || (task.status === 'needs_user' && task.handoff?.kind !== 'clarification'), emergencyStopShortcut };
}
