import type { TaskSnapshot } from '../../../shared/contracts/task';

interface TaskNotificationEvent {
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

function handoffKey(snapshot: TaskSnapshot): string | null {
  const handoff = snapshot.handoff;
  return handoff ? `${handoff.kind}:${handoff.reason}` : null;
}

/**
 * Describe the OS notification for a snapshot transition, or null when
 * nothing notable happened. Pure function so the trigger rules stay testable.
 */
export function describeNotification(previous: TaskSnapshot | null, next: TaskSnapshot): TaskNotificationEvent | null {
  if (!next.runId) return null;
  if (next.pendingActionId && next.pendingActionId !== previous?.pendingActionId) {
    const action = next.actions.find(candidate => candidate.id === next.pendingActionId);
    return {
      key: `${next.runId}:approval:${next.pendingActionId}`,
      title: 'Ghost Agent needs approval',
      body: action ? action.description : next.message || next.goal,
    };
  }
  const handoff = next.handoff;
  if (handoff && handoffKey(next) !== (previous ? handoffKey(previous) : null)) {
    return {
      key: `${next.runId}:handoff:${handoff.kind}:${handoff.reason}`,
      title: 'Ghost Agent needs you',
      body: handoff.reason,
    };
  }
  if (next.status !== previous?.status) {
    if (next.status === 'completed') {
      return { key: `${next.runId}:completed`, title: 'Task completed', body: next.goal };
    }
    if (next.status === 'failed') {
      return { key: `${next.runId}:failed`, title: 'Task failed', body: next.message || next.goal };
    }
  }
  return null;
}

function fire(event: TaskNotificationEvent): void {
  new Notification(event.title, { body: event.body });
}

/**
 * Show an OS notification. Never throws: Electron renderers support the
 * Notification API natively, everywhere else this is a silent no-op.
 */
export function showNotification(event: TaskNotificationEvent): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      fire(event);
      return;
    }
    if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
      void Notification.requestPermission().then(permission => {
        if (permission === 'granted') fire(event);
      });
    }
  } catch {
    // Notifications must never break the app.
  }
}
