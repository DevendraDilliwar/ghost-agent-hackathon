import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeNotification, showNotification } from './task-notifier';
import type { TaskSnapshot } from '../../../shared/contracts/task';

function snapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    runId: 'run-1', revision: 1, status: 'acting', goal: 'Do the thing', maxSteps: 25, maxMinutes: 5,
    actions: [], messages: [], screenshot: null, pendingActionId: null, message: '',
    awaitingCompletion: false, handoff: null, inputTokens: 0, outputTokens: 0, intent: null, mission: null,
    ...overrides,
  };
}

describe('describeNotification', () => {
  it('returns null without a run or notable change', () => {
    expect(describeNotification(null, snapshot({ runId: null }))).toBeNull();
    const current = snapshot();
    expect(describeNotification(current, { ...current, revision: 2 })).toBeNull();
  });

  it('notifies on new approval requests with the action description', () => {
    const event = describeNotification(snapshot(), snapshot({
      pendingActionId: 'a-1',
      actions: [{ id: 'a-1', type: 'click', description: 'Click Buy now', timestamp: 't', status: 'awaiting_approval' }],
    }));
    expect(event).toMatchObject({ title: 'Ghost Agent needs approval', body: 'Click Buy now' });
    expect(event?.key).toContain('run-1:approval:a-1');
    expect(describeNotification(
      snapshot({ pendingActionId: 'a-1' }),
      snapshot({ pendingActionId: 'a-1', revision: 2 }),
    )).toBeNull();
  });

  it('notifies on handoff, completion, and failure', () => {
    expect(describeNotification(
      snapshot(),
      snapshot({ handoff: { kind: 'login', reason: 'Sign in to continue' } }),
    )).toMatchObject({ title: 'Ghost Agent needs you', body: 'Sign in to continue' });
    expect(describeNotification(
      snapshot({ status: 'acting' }),
      snapshot({ status: 'completed', revision: 2 }),
    )).toMatchObject({ title: 'Task completed', body: 'Do the thing' });
    expect(describeNotification(
      snapshot({ status: 'acting' }),
      snapshot({ status: 'failed', message: 'Boom', revision: 2 }),
    )).toMatchObject({ title: 'Task failed', body: 'Boom' });
  });
});

describe('showNotification', () => {
  const globals = globalThis as Record<string, unknown>;
  const realNotification = globals.Notification;

  afterEach(() => {
    globals.Notification = realNotification;
  });

  it('is a silent no-op without Notification support', () => {
    globals.Notification = undefined;
    expect(() => showNotification({ key: 'k', title: 't', body: 'b' })).not.toThrow();
  });

  it('fires through the Notification API when granted', () => {
    const fire = vi.fn();
    globals.Notification = Object.assign(fire, { permission: 'granted' });
    showNotification({ key: 'k', title: 'Hello', body: 'World' });
    expect(fire).toHaveBeenCalledWith('Hello', { body: 'World' });
  });
});
