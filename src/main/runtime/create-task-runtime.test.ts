import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ModelDecision } from '../../agent/ports';
import type { RunConfiguration } from '../../shared/contracts/task';
import { createTaskRuntime } from './create-task-runtime';

const stubs = vi.hoisted(() => ({
  preflight: vi.fn(), capture: vi.fn(), execute: vi.fn(), decide: vi.fn(),
  probe: vi.fn(), modelOptions: vi.fn(), register: vi.fn(), unregister: vi.fn(),
}));
vi.mock('electron', () => ({ globalShortcut: { register: stubs.register, unregister: stubs.unregister } }));
vi.mock('../../desktop/linux/ubuntu-desktop', () => ({ UbuntuDesktop: class {
  preflight = stubs.preflight;
  capture = stubs.capture;
  execute = stubs.execute;
} }));
vi.mock('../../providers/meta/meta-request', () => ({ testMetaConnection: stubs.probe }));
vi.mock('../../providers/meta/meta-computer-model', () => ({ MetaComputerModel: class {
  constructor(options: unknown) { stubs.modelOptions(options); }
  decide = stubs.decide;
} }));

const runtimes: ReturnType<typeof createTaskRuntime>[] = [];
const configuration: RunConfiguration = {
  goal: 'Type a test greeting', maxSteps: 5, approvalMode: 'ask_approval', screenConsent: true, isolatedEnvironment: true,
};
const finished: ModelDecision = { action: null, message: 'Review the result.', warnings: [], inputTokens: 1, outputTokens: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('META_API_KEY', '');
  vi.stubEnv('GHOST_META_MODEL', 'muse-spark-1.3');
  stubs.register.mockReturnValue(true);
  stubs.probe.mockResolvedValue(undefined);
  stubs.preflight.mockResolvedValue(undefined);
  stubs.capture.mockResolvedValue({ image: 'data:image/png;base64,dGVzdA==', width: 800, height: 600,
    desktopWidth: 800, desktopHeight: 600, activeWindowId: '100', capturedAt: Date.now() });
  stubs.decide.mockResolvedValue(finished);
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
    expect(stubs.modelOptions).toHaveBeenCalledTimes(2);
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
