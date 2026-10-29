import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerTaskIpc } from './register-task-ipc';
import type { TaskRuntime } from '../runtime/create-task-runtime';
import { IPC_CHANNELS } from '../../shared/ipc/channels';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

function setup(ready = true) {
  const frame = { url: 'file:///app/index.html' };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents } as unknown as BrowserWindow;
  const probe = vi.fn().mockResolvedValue({ configured: true, verified: true, model: 'muse-spark-1.3', source: 'session' });
  const start = vi.fn();
  const runtime = { testConnection: probe, start,
    readiness: async () => ({ ready, issues: ready ? [] : ['Fix desktop setup first.'] }),
  } as unknown as TaskRuntime;
  registerTaskIpc(window, frame.url, runtime, async () => undefined);
  const handlers = new Map(vi.mocked(ipcMain.handle).mock.calls.map(([channel, handler]) => [channel, handler]));
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  return { handlers, event, probe, start };
}

describe('task and setup IPC boundary', () => {
  it('rejects credential changes from another window or a subframe before calling the connection service', () => {
    const { handlers, event, probe } = setup();
    const test = handlers.get(IPC_CHANNELS.testModelConnection)!;
    expect(() => test({ ...event, sender: {} } as IpcMainInvokeEvent, 'private-key')).toThrow('Rejected');
    expect(() => test({ ...event, senderFrame: { url: 'file:///app/index.html' } } as IpcMainInvokeEvent, 'private-key')).toThrow('Rejected');
    expect(() => test(event, 'private-key', 'extra')).toThrow('Rejected');
    expect(probe).not.toHaveBeenCalled();
  });

  it('passes a credential only to the main-process service and returns connection metadata', async () => {
    const { handlers, event, probe } = setup();
    const result = await handlers.get(IPC_CHANNELS.testModelConnection)!(event, 'private-key');
    expect(probe).toHaveBeenCalledWith('private-key');
    expect(JSON.stringify(result)).not.toContain('private-key');
  });

  it('does not start a task if prerequisites are not ready', async () => {
    const { handlers, event, start } = setup(false);
    await expect(handlers.get(IPC_CHANNELS.startTask)!(event, {
      goal: 'Open the text editor', maxSteps: 5, approvalMode: 'ask_approval', screenConsent: true, isolatedEnvironment: true,
    })).rejects.toThrow('Fix desktop setup');
    expect(start).not.toHaveBeenCalled();
  });
});
