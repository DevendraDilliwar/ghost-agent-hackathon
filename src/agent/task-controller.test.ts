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
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

function setup(overrides?: Partial<import('./task-controller').ControllerDependencies>) {
  let id = 0;
  const desktop = { preflight: vi.fn().mockResolvedValue(undefined), capture: vi.fn().mockResolvedValue(frame), execute: vi.fn().mockResolvedValue(undefined) };
  const model = { decide: vi.fn().mockResolvedValue(proposed),
    parseIntent: vi.fn().mockResolvedValue({ intent: { summary: 'Test goal', params: {}, missing: [] }, inputTokens: 10, outputTokens: 5 }),
    verifyText: vi.fn().mockResolvedValue({ confirmed: true, detail: 'Visible.', inputTokens: 5, outputTokens: 2 }) };
  const changed = vi.fn();
  const clock = { now: 1000 };
  const controller = new TaskController({
    desktop, model, id: () => 'id-' + ++id, describe: () => 'Click the test target',
    validateAction: action => action as NonNullable<ModelDecision['action']>, changed, now: () => clock.now,
    ...overrides,
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

  it('does not send grounding tags to the model when the detector returns none', async () => {
    const { controller, model } = setup();
    controller.start(configuration);
    await flush();
    expect(model.decide).toHaveBeenCalled();
    expect(model.decide.mock.calls[0]?.[0].grounding).toBeUndefined();
    expect(controller.getSnapshot().groundedElements).toEqual([]);
  });

  it('forwards grounding tags to the model when a detector provides them', async () => {
    const detected = {
      elements: [{
        id: 1, type: 'button' as const, label: 'Save',
        bounds: { x: 100, y: 200, width: 140, height: 36 },
        center: { x: 170, y: 218 }, confidence: 0.95,
      }],
      totalElements: 1, processedAt: 0,
    };
    const { controller, model } = setup({ grounding: { groundScreen: () => detected } });
    controller.start(configuration);
    await flush();
    expect(model.decide.mock.calls[0]?.[0].grounding).toBe(detected);
    expect(controller.getSnapshot().groundedElements).toEqual(detected.elements);
  });

  it('parses intent before the first capture and waits for it', async () => {
    const { controller, desktop, model } = setup();
    let resolve!: (value: unknown) => void;
    model.parseIntent.mockReturnValueOnce(new Promise<unknown>(done => { resolve = done; }));
    controller.start(configuration);
    await flush();
    expect(model.parseIntent).toHaveBeenCalledTimes(1);
    expect(desktop.capture).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('preparing');
    resolve({ intent: { summary: 'Test goal', params: {}, missing: [] }, inputTokens: 10, outputTokens: 5 });
    await flush();
    expect(desktop.capture).toHaveBeenCalled();
  });

  it('asks for missing values before touching the desktop', async () => {
    const { controller, desktop, model } = setup();
    model.parseIntent.mockResolvedValueOnce({ intent: { summary: 'Enter the voucher', params: { date: '12-10-2026' }, missing: ['amount'] }, inputTokens: 10, outputTokens: 5 });
    controller.start(configuration);
    await flush();
    expect(controller.getSnapshot().status).toBe('needs_user');
    expect(controller.getSnapshot().handoff?.kind).toBe('clarification');
    expect(controller.getSnapshot().intent).toBeNull();
    expect(desktop.capture).not.toHaveBeenCalled();
    expect(model.decide).not.toHaveBeenCalled();
  });

  it('re-parses with the clarification answer and then observes', async () => {
    const { controller, desktop, model } = setup();
    model.parseIntent.mockResolvedValueOnce({ intent: { summary: 'Enter the voucher', params: {}, missing: ['amount'] }, inputTokens: 10, outputTokens: 5 });
    const run = controller.start(configuration);
    await flush();
    controller.resume(run.runId!, '25000');
    await flush();
    expect(model.parseIntent).toHaveBeenCalledTimes(2);
    expect(model.parseIntent.mock.calls[1]?.[0].clarifications).toEqual(['25000']);
    expect(desktop.capture).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().intent).toMatchObject({ summary: 'Test goal' });
  });

  it('fails before any capture when intent parsing exhausts the token allowance', async () => {
    const { controller, desktop, model } = setup();
    model.parseIntent.mockResolvedValueOnce({ intent: { summary: 'Test goal', params: {}, missing: [] }, inputTokens: 100, outputTokens: 9000 });
    controller.start(configuration);
    await flush();
    expect(controller.getSnapshot().status).toBe('failed');
    expect(controller.getSnapshot().message).toContain('token allowance');
    expect(desktop.capture).not.toHaveBeenCalled();
  });

  it('verifies typed text after a type action and continues on confirmation', async () => {
    const { controller, model } = setup();
    model.decide.mockResolvedValueOnce({ ...proposed, action: { type: 'type', text: '25000' } });
    const run = controller.start(configuration);
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    expect(model.verifyText).toHaveBeenCalledTimes(1);
    expect(model.verifyText.mock.calls[0]?.[0].text).toBe('25000');
    expect(controller.getSnapshot().actions[0]?.verification?.status).toBe('verified_success');
  });

  it('does not verify non-type actions', async () => {
    const { controller, model } = setup();
    const run = controller.start(configuration);
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    expect(model.verifyText).not.toHaveBeenCalled();
    expect(controller.getSnapshot().actions[0]?.verification?.status).toBe('stalled_no_change');
    expect(controller.getSnapshot().status).toBe('awaiting_approval');
  });

  it('retries once with a note on mismatch, then hands to the user', async () => {
    const { controller, model } = setup();
    model.decide.mockResolvedValue({ ...proposed, action: { type: 'type', text: '25000' } });
    model.verifyText.mockResolvedValue({ confirmed: false, detail: 'No text field visible.', inputTokens: 5, outputTokens: 2 });
    controller.start({ ...configuration, approvalMode: 'full_access' });
    await flush();
    await flush();
    expect(model.verifyText).toHaveBeenCalledTimes(2);
    expect(model.decide).toHaveBeenCalledTimes(2);
    expect(model.decide.mock.calls[1]?.[0].history).toContain('The typed value is not visible on screen. Re-check focus and the target field before typing again.');
    expect(controller.getSnapshot().status).toBe('needs_user');
    expect(controller.getSnapshot().handoff?.kind).toBe('manual');
  });

  it('hands to the user after two consecutive stalls', async () => {
    const { controller, model } = setup();
    controller.start({ ...configuration, approvalMode: 'full_access' });
    await flush();
    await flush();
    expect(model.verifyText).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('needs_user');
    expect(controller.getSnapshot().handoff?.kind).toBe('manual');
  });

  it('resets the no-progress streak after verified progress', async () => {
    const { controller, model } = setup();
    model.decide.mockResolvedValue({ ...proposed, action: { type: 'type', text: '25000' } });
    model.verifyText
      .mockResolvedValueOnce({ confirmed: false, detail: 'Not visible.', inputTokens: 5, outputTokens: 2 })
      .mockResolvedValueOnce({ confirmed: true, detail: 'Visible.', inputTokens: 5, outputTokens: 2 })
      .mockResolvedValueOnce({ confirmed: false, detail: 'Not visible.', inputTokens: 5, outputTokens: 2 })
      .mockResolvedValueOnce({ confirmed: false, detail: 'Still not visible.', inputTokens: 5, outputTokens: 2 });
    controller.start({ ...configuration, approvalMode: 'full_access', maxSteps: 6 });
    await flush();
    await flush();
    await flush();
    expect(model.verifyText).toHaveBeenCalledTimes(4);
    expect(model.decide).toHaveBeenCalledTimes(4);
    expect(controller.getSnapshot().status).toBe('needs_user');
  });

  it('fails the run when verification errors', async () => {
    const { controller, desktop, model } = setup();
    model.decide.mockResolvedValueOnce({ ...proposed, action: { type: 'type', text: '25000' } });
    model.verifyText.mockRejectedValueOnce(new Error('Meta could not verify the screen.'));
    const run = controller.start(configuration);
    await flush();
    controller.review(run.runId!, controller.getSnapshot().pendingActionId!, true);
    await flush();
    expect(controller.getSnapshot().status).toBe('failed');
    expect(controller.getSnapshot().message).toContain('could not verify');
    expect(desktop.execute).toHaveBeenCalledTimes(1);
  });

});
