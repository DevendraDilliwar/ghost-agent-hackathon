import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskController } from './task-controller';
import type { ModelDecision } from './ports';
import type { RunConfiguration } from '../shared/contracts/task';
import type { ScreenObservation } from '../shared/contracts/desktop';

const frame: ScreenObservation = {
  image: 'data:image/png;base64,c3ludGhldGlj', width: 800, height: 600,
  desktopWidth: 800, desktopHeight: 600, activeWindowId: '100', capturedAt: 1000,
};
const configuration: RunConfiguration = {
  goal: 'Open the test page', maxSteps: 2, approvalMode: 'ask_approval', screenConsent: true, isolatedEnvironment: true,
};
const proposed: ModelDecision = { action: { type: 'click', x: 10, y: 10, button: 'left' }, message: '', warnings: [], inputTokens: 100, outputTokens: 20 };
const finished: ModelDecision = { action: null, message: 'The task appears complete.', warnings: [], inputTokens: 100, outputTokens: 20 };
const controllers: TaskController[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}

function setup() {
  let id = 0;
  const desktop = { preflight: vi.fn().mockResolvedValue(undefined), capture: vi.fn().mockResolvedValue(frame), execute: vi.fn().mockResolvedValue(undefined) };
  const model = { decide: vi.fn().mockResolvedValue(proposed) };
  const changed = vi.fn();
  const clock = { now: 1000 };
  const controller = new TaskController({
    desktop, model, id: () => 'id-' + ++id, describe: () => 'Click the test target',
    validateAction: action => action as NonNullable<ModelDecision['action']>, changed, now: () => clock.now,
  });
  controllers.push(controller);
  return { controller, desktop, model, clock, changed };
}

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.useRealTimers();
});

describe('task lifecycle', () => {
  it('waits for explicit approval before executing any proposed input', async () => {
    const { controller, desktop } = setup();
    controller.start(configuration);
    await flush();
    const state = controller.getSnapshot();
    expect(state.status).toBe('awaiting_approval');
    expect(desktop.execute).not.toHaveBeenCalled();
    controller.review(state.runId!, state.pendingActionId!, true);
    await flush();
    expect(desktop.execute).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().actions[0]?.status).toBe('executed');
  });

  it('executes proposed input immediately without pausing when in full_access mode', async () => {
    const { controller, desktop } = setup();
    controller.start({ ...configuration, approvalMode: 'full_access' });
    await flush();
    expect(desktop.execute).toHaveBeenCalled();
    expect(controller.getSnapshot().status).not.toBe('awaiting_approval');
  });

  it('rejects a second concurrent run without dispatching more work', async () => {
    const { controller, desktop } = setup();
    controller.start(configuration);
    expect(() => controller.start(configuration)).toThrow('Stop the current run');
    await flush();
    expect(desktop.capture).toHaveBeenCalledTimes(1);
  });

  it('discards a late provider decision after Stop', async () => {
    const { controller, desktop, model } = setup();
    const delayed = deferred<ModelDecision>();
    model.decide.mockReturnValueOnce(delayed.promise);
    const run = controller.start(configuration);
    await flush();
    controller.stop(run.runId!);
    delayed.resolve(proposed);
    await flush();
    expect(controller.getSnapshot().status).toBe('stopped');
    expect(controller.getSnapshot().pendingActionId).toBeNull();
    expect(desktop.execute).not.toHaveBeenCalled();
  });

  it('does not call the model when capture finishes after Stop', async () => {
    const { controller, desktop, model } = setup();
    const delayed = deferred<ScreenObservation>();
    desktop.capture.mockReturnValueOnce(delayed.promise);
    const run = controller.start(configuration);
    await flush();
    controller.stop(run.runId!);
    delayed.resolve(frame);
    await flush();
    expect(model.decide).not.toHaveBeenCalled();
  });

  it('invalidates a pending approval on pause and observes again on resume', async () => {
    const { controller, desktop } = setup();
    const run = controller.start(configuration);
    await flush();
    const old = controller.getSnapshot().pendingActionId!;
    controller.pause(run.runId!);
    expect(() => controller.review(run.runId!, old, true)).toThrow('no longer awaiting');
    controller.resume(run.runId!);
    await flush();
    expect(desktop.capture).toHaveBeenCalledTimes(2);
    expect(desktop.execute).not.toHaveBeenCalled();
    expect(controller.getSnapshot().pendingActionId).not.toBe(old);
  });

  it('requires a fresh decision when an observation has expired', async () => {
    const { controller, desktop, clock } = setup();
    const run = controller.start(configuration);
    await flush();
    const action = controller.getSnapshot().pendingActionId!;
    clock.now = 32_000;
    controller.review(run.runId!, action, true);
    await flush();
    expect(desktop.execute).not.toHaveBeenCalled();
    expect(desktop.capture).toHaveBeenCalledTimes(2);
  });

  it('stops on a rejected action', async () => {
    const { controller, desktop } = setup();
    const run = controller.start(configuration);
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, false);
    expect(controller.getSnapshot().status).toBe('stopped');
    expect(controller.getSnapshot().actions[0]?.status).toBe('rejected');
    expect(desktop.execute).not.toHaveBeenCalled();
  });

  it('requires the user to confirm a model result and a fresh final observation', async () => {
    const { controller, model, desktop } = setup();
    model.decide.mockResolvedValueOnce(finished);
    const run = controller.start(configuration);
    await flush();
    expect(controller.getSnapshot().status).toBe('verifying');
    expect(controller.getSnapshot().awaitingCompletion).toBe(true);
    expect(desktop.capture).toHaveBeenCalledTimes(2);
    controller.confirm(run.runId!, true);
    expect(controller.getSnapshot().status).toBe('completed');
  });

  it('enforces the action limit while still allowing final result verification', async () => {
    const { controller, model, desktop } = setup();
    model.decide.mockResolvedValueOnce(proposed).mockResolvedValueOnce(finished);
    const run = controller.start({ ...configuration, maxSteps: 1 });
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    expect(desktop.execute).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe('verifying');
  });

  it('refuses another action after the budget is exhausted', async () => {
    const { controller, desktop } = setup();
    const run = controller.start({ ...configuration, maxSteps: 1 });
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    expect(controller.getSnapshot().status).toBe('failed');
    expect(desktop.execute).toHaveBeenCalledTimes(1);
  });

  it('fails before capture or inference when desktop preflight fails', async () => {
    const { controller, desktop, model } = setup();
    desktop.preflight.mockRejectedValueOnce(new Error('Unsupported desktop'));
    controller.start(configuration);
    await flush();
    expect(controller.getSnapshot().message).toBe('Unsupported desktop');
    expect(desktop.capture).not.toHaveBeenCalled();
    expect(model.decide).not.toHaveBeenCalled();
  });

  it('stops a pending run after its wall-clock deadline', async () => {
    vi.useFakeTimers();
    const { controller, model } = setup();
    model.decide.mockReturnValue(new Promise(() => undefined));
    controller.start(configuration);
    await flush();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(controller.getSnapshot().status).toBe('failed');
    expect(controller.getSnapshot().message).toContain('five-minute');
  });

  it('keeps revisions increasing across runs and rejects old run identifiers', async () => {
    const { controller } = setup();
    const first = controller.start(configuration);
    await flush();
    controller.stop(first.runId!);
    const revision = controller.getSnapshot().revision;
    const second = controller.start(configuration);
    expect(second.revision).toBeGreaterThan(revision);
    expect(() => controller.stop(first.runId!)).toThrow('no longer current');
  });

  it('does not replay an interrupted input or accept its late completion', async () => {
    const { controller, desktop } = setup();
    const execution = deferred<void>();
    desktop.execute.mockReturnValueOnce(execution.promise);
    const run = controller.start(configuration);
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    controller.stop(run.runId!);
    execution.resolve();
    await flush();
    expect(controller.getSnapshot().status).toBe('stopped');
    expect(controller.getSnapshot().actions[0]?.status).toBe('failed');
    expect(desktop.execute).toHaveBeenCalledTimes(1);
    expect(desktop.capture).toHaveBeenCalledTimes(1);
  });
  it('hands verification to the user without another capture or input, then resumes from a fresh screen', async () => {
    const { controller, desktop, model } = setup();
    model.decide.mockResolvedValueOnce({ ...finished, handoff: { kind: 'verification', reason: 'Complete verification in the browser.' } });
    const run = controller.start(configuration);
    await flush();
    expect(controller.getSnapshot()).toMatchObject({ status: 'needs_user', screenshot: null, awaitingCompletion: false });
    expect(desktop.capture).toHaveBeenCalledTimes(1);
    expect(desktop.execute).not.toHaveBeenCalled();
    await flush();
    expect(model.decide).toHaveBeenCalledTimes(1);
    controller.resume(run.runId!);
    await flush();
    expect(desktop.capture).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().status).toBe('awaiting_approval');
    expect(controller.getSnapshot().handoff).toBeNull();
  });

  it('invalidates pending input during manual takeover and rejects the old approval', async () => {
    const { controller, desktop } = setup();
    const run = controller.start(configuration);
    await flush();
    const oldApproval = controller.getSnapshot().pendingActionId!;
    controller.takeOver(run.runId!);
    expect(controller.getSnapshot().status).toBe('needs_user');
    expect(controller.getSnapshot().screenshot).toBeNull();
    expect(() => controller.review(run.runId!, oldApproval, true)).toThrow('no longer awaiting');
    expect(desktop.execute).not.toHaveBeenCalled();
    controller.stop(run.runId!);
    expect(() => controller.resume(run.runId!)).toThrow('paused task');
  });

  it('ignores a late model action after manual takeover', async () => {
    const { controller, desktop, model } = setup();
    const delayed = deferred<ModelDecision>();
    model.decide.mockReturnValueOnce(delayed.promise);
    const run = controller.start(configuration);
    await flush();
    controller.takeOver(run.runId!);
    delayed.resolve(proposed);
    await flush();
    expect(controller.getSnapshot().status).toBe('needs_user');
    expect(controller.getSnapshot().pendingActionId).toBeNull();
    expect(desktop.execute).not.toHaveBeenCalled();
  });

  it('keeps the run bounded while waiting for human input', async () => {
    vi.useFakeTimers();
    const { controller } = setup();
    const run = controller.start(configuration);
    await flush();
    controller.takeOver(run.runId!);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(controller.getSnapshot().status).toBe('failed');
    expect(controller.getSnapshot().handoff).toBeNull();
  });

  it('requires a clarification answer before any new observation and includes it in the next model decision', async () => {
    const { controller, desktop, model } = setup();
    model.decide.mockResolvedValueOnce({ ...finished, handoff: { kind: 'clarification', reason: 'Which branch should I use?' } });
    const run = controller.start(configuration);
    await flush();
    expect(() => controller.resume(run.runId!)).toThrow('Answer the clarification');
    expect(() => controller.resume(run.runId!, 'x'.repeat(1001))).toThrow('Answer the clarification');
    expect(desktop.capture).toHaveBeenCalledTimes(1);
    controller.resume(run.runId!, 'Use the test branch');
    await flush();
    expect(desktop.capture).toHaveBeenCalledTimes(2);
    expect(model.decide.mock.calls[1]?.[0].history).toContain('User clarification: Use the test branch');
    expect(controller.getSnapshot().messages.at(-1)?.content).toContain('Use the test branch');
  });

  it('bounds clarification history and does not dispatch work after the question allowance', async () => {
    const { controller, desktop, model } = setup();
    model.decide.mockResolvedValue({ ...finished, handoff: { kind: 'clarification', reason: 'Please clarify the task.' } });
    const run = controller.start(configuration);
    await flush();
    for (let index = 0; index < 5; index++) {
      controller.resume(run.runId!, 'Answer ' + index);
      await flush();
    }
    expect(() => controller.resume(run.runId!, 'Another answer')).toThrow('after five questions');
    expect(desktop.capture).toHaveBeenCalledTimes(6);
    expect(controller.getSnapshot().status).toBe('needs_user');
  });

});
