import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ModelDecision } from '../../agent/ports';
import type { RunConfiguration } from '../../shared/contracts/task';
import { createTaskRuntime } from './create-task-runtime';

const stubs = vi.hoisted(() => ({
  preflight: vi.fn(), capture: vi.fn(), execute: vi.fn(), decide: vi.fn(), parseIntent: vi.fn(), verifyText: vi.fn(),
  probe: vi.fn(), modelOptions: vi.fn(), register: vi.fn(), unregister: vi.fn(), isRegistered: vi.fn(),
}));
vi.mock('electron', () => ({ globalShortcut: { register: stubs.register, unregister: stubs.unregister, isRegistered: stubs.isRegistered } }));
vi.mock('../../desktop/linux/ubuntu-desktop', () => ({ UbuntuDesktop: class {
  preflight = stubs.preflight;
  capture = stubs.capture;
  execute = stubs.execute;
} }));
vi.mock('../../providers/meta/meta-request', () => ({ testMetaConnection: stubs.probe }));
vi.mock('../../providers/meta/meta-computer-model', () => ({ MetaComputerModel: class {
  constructor(options: unknown) { stubs.modelOptions(options); }
  decide = stubs.decide;
  parseIntent = stubs.parseIntent;
  verifyText = stubs.verifyText;
} }));

const runtimes: ReturnType<typeof createTaskRuntime>[] = [];
const registered = new Set<string>();
const configuration: RunConfiguration = {
  goal: 'Type a test greeting', maxSteps: 5, approvalMode: 'ask_approval', screenConsent: true, isolatedEnvironment: true,
};
const finished: ModelDecision = { action: null, message: 'Review the result.', warnings: [], inputTokens: 1, outputTokens: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('META_API_KEY', '');
  vi.stubEnv('GHOST_META_MODEL', 'muse-spark-1.3');
  registered.clear();
  stubs.register.mockImplementation((accelerator: string) => { registered.add(accelerator); return true; });
  stubs.isRegistered.mockImplementation((accelerator: string) => registered.has(accelerator));
  stubs.unregister.mockImplementation((accelerator: string) => { registered.delete(accelerator); });
  stubs.probe.mockResolvedValue(undefined);
  stubs.preflight.mockResolvedValue(undefined);
  stubs.capture.mockResolvedValue({ image: 'data:image/png;base64,dGVzdA==', width: 800, height: 600,
    desktopWidth: 800, desktopHeight: 600, activeWindowId: '100', capturedAt: Date.now() });
  stubs.decide.mockResolvedValue(finished);
  stubs.parseIntent.mockResolvedValue({ intent: { summary: 'Test goal', params: {}, missing: [] }, inputTokens: 1, outputTokens: 1 });
  stubs.verifyText.mockResolvedValue({ confirmed: true, detail: 'Visible.', inputTokens: 1, outputTokens: 1 });
});

describe('emergency Stop registration and task readiness', () => {
  it('keeps a working primary shortcut across rechecks without duplicate registration', async () => {
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    for (let index = 0; index < 3; index++) {
      expect(await runtime.readiness()).toMatchObject({ ready: true, emergencyStopReady: true, emergencyStopShortcut: 'Ctrl + Shift + Escape' });
    }
    expect(stubs.register).toHaveBeenCalledTimes(1);
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('falls back on a busy primary shortcut and completes an approved task', async () => {
    stubs.register.mockReturnValueOnce(false);
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    expect(await runtime.readiness()).toMatchObject({ ready: true, emergencyStopReady: true, emergencyStopShortcut: 'Ctrl + Alt + Shift + Escape' });
    expect(runtime.getControlsSnapshot().emergencyStopShortcut).toBe('Ctrl + Alt + Shift + Escape');
    stubs.decide.mockResolvedValueOnce({ ...finished, action: { type: 'type', text: 'Hello from Ghost Agent!' } });
    const task = runtime.start(configuration);
    await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('awaiting_approval'));
    expect(stubs.execute).not.toHaveBeenCalled();
    runtime.controller.review(task.runId!, runtime.controller.getSnapshot().pendingActionId!, true);
    await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('verifying'));
    runtime.controller.confirm(task.runId!, true);
    expect(runtime.controller.getSnapshot().status).toBe('completed');
    expect(stubs.execute).toHaveBeenCalledTimes(1);
    expect(stubs.execute.mock.calls[0]?.[0]).toEqual({ type: 'type', text: 'Hello from Ghost Agent!' });
    expect(stubs.register).toHaveBeenCalledTimes(2);
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('continues to the last fallback after a registration error and a conflict', async () => {
    stubs.register.mockImplementationOnce(() => { throw new Error('Shortcut unavailable'); }).mockReturnValueOnce(false);
    const runtime = setup();
    expect(await runtime.readiness()).toMatchObject({ emergencyStopReady: true, emergencyStopShortcut: 'Ctrl + Shift + F12' });
    expect(stubs.register).toHaveBeenCalledTimes(3);
  });

  it('blocks task execution when all shortcuts fail without invalidating the verified key', async () => {
    stubs.register.mockReturnValue(false);
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    const ready = await runtime.readiness();
    expect(ready).toMatchObject({ ready: false, modelVerified: true, desktopSupported: true, emergencyStopReady: false, emergencyStopShortcut: null });
    expect(ready.issues).toHaveLength(1);
    expect(ready.issues[0]).toContain('Recheck desktop');
    expect(() => runtime.start(configuration)).toThrow('No emergency Stop shortcut is available');
    expect(stubs.capture).not.toHaveBeenCalled();
    expect(stubs.decide).not.toHaveBeenCalled();
    expect(stubs.execute).not.toHaveBeenCalled();
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('retries registration on Recheck and recovers without another connection test', async () => {
    stubs.register.mockReturnValue(false);
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    expect((await runtime.readiness()).ready).toBe(false);
    stubs.register.mockImplementation((accelerator: string) => { registered.add(accelerator); return true; });
    expect(await runtime.readiness()).toMatchObject({ ready: true, modelVerified: true, emergencyStopShortcut: 'Ctrl + Shift + Escape' });
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('reacquires an unexpectedly lost registration instead of returning cached readiness', async () => {
    const runtime = setup();
    registered.clear();
    stubs.register.mockReturnValueOnce(false);
    expect(await runtime.readiness()).toMatchObject({ emergencyStopReady: true, emergencyStopShortcut: 'Ctrl + Alt + Shift + Escape' });
    expect(stubs.register).toHaveBeenCalledTimes(3);
  });

  it('the fallback callback stops the current run and cannot execute a pending action', async () => {
    stubs.register.mockReturnValueOnce(false);
    const runtime = setup();
    const stop = stubs.register.mock.calls[1]![1] as () => void;
    expect(() => stop()).not.toThrow();
    await runtime.testConnection('fake-session-key');
    stubs.decide.mockResolvedValue({ ...finished, action: { type: 'type', text: 'Test' } });
    for (let index = 0; index < 2; index++) {
      const task = runtime.start(configuration);
      await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('awaiting_approval'));
      const actionId = runtime.controller.getSnapshot().pendingActionId!;
      stop();
      expect(runtime.controller.getSnapshot().status).toBe('stopped');
      expect(() => runtime.controller.review(task.runId!, actionId, true)).toThrow('no longer awaiting approval');
    }
    expect(stubs.execute).not.toHaveBeenCalled();
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('releases only its chosen shortcut once and never registers after disposal', async () => {
    // A different registration in this process must be left alone.
    registered.add('Control+Shift+Escape');
    const runtime = setup();
    expect(stubs.register.mock.calls[0]?.[0]).toBe('Control+Alt+Shift+Escape');
    runtime.dispose();
    runtime.dispose();
    expect(await runtime.readiness()).toMatchObject({ ready: false, emergencyStopReady: false, emergencyStopShortcut: null });
    expect(stubs.register).toHaveBeenCalledTimes(1);
    expect(stubs.unregister.mock.calls).toEqual([['Control+Alt+Shift+Escape']]);
    expect(registered.has('Control+Shift+Escape')).toBe(true);
  });
});
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  vi.unstubAllEnvs();
});

function setup() {
  const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: vi.fn() } } as unknown as BrowserWindow;
  const runtime = createTaskRuntime(window, window);
  runtimes.push(runtime);
  return runtime;
}

describe('model connection across tasks in one app session', () => {
  it('uses one verified key for successive completed tasks without another connection test', async () => {
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    for (let index = 0; index < 2; index++) {
      expect((await runtime.readiness()).ready).toBe(true);
      const task = runtime.start(configuration);
      await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('verifying'));
      runtime.controller.confirm(task.runId!, true);
      expect(runtime.connection.info()).toMatchObject({ configured: true, verified: true, source: 'session' });
    }
    expect(stubs.probe).toHaveBeenCalledTimes(1);
    // One parseIntent + one decide call per task, each constructing a model instance.
    expect(stubs.modelOptions).toHaveBeenCalledTimes(4);
    expect(stubs.modelOptions.mock.calls.every(([options]) => options.apiKey === 'fake-session-key')).toBe(true);
    expect(JSON.stringify(runtime.connection.info())).not.toContain('fake-session-key');
  });

  it('retains connection after a failed task and after Stop', async () => {
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    stubs.capture.mockRejectedValueOnce(new Error('Test screenshot unavailable.'));
    runtime.start(configuration);
    await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('failed'));
    expect(runtime.connection.info().verified).toBe(true);
    const next = runtime.start(configuration);
    await vi.waitFor(() => expect(runtime.controller.getSnapshot().status).toBe('verifying'));
    runtime.controller.stop(next.runId!);
    expect(runtime.controller.getSnapshot().status).toBe('stopped');
    expect(runtime.connection.info().verified).toBe(true);
    expect((await runtime.readiness()).ready).toBe(true);
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });

  it('reports desktop failure independently and recovers without re-entering or testing the key', async () => {
    const runtime = setup();
    await runtime.testConnection('fake-session-key');
    stubs.preflight.mockRejectedValueOnce(new Error('Test desktop unavailable.'));
    expect(await runtime.readiness()).toMatchObject({ ready: false, desktopSupported: false,
      modelConfigured: true, modelVerified: true, issues: ['Test desktop unavailable.'] });
    expect(runtime.connection.info().verified).toBe(true);
    expect((await runtime.readiness()).ready).toBe(true);
    expect(stubs.probe).toHaveBeenCalledTimes(1);
  });
});
