import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { registerControlsIpc } from './register-controls-ipc';
import type { TaskRuntime } from '../runtime/create-task-runtime';
import { controlsSnapshot } from '../windows/controls-snapshot';
import { idleSnapshot } from '../../agent/task-controller';
import { IPC_CHANNELS } from '../../shared/ipc/channels';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

function setup() {
  const frame = { url: 'file:///app/controls.html' };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents } as unknown as BrowserWindow;
  const stop = vi.fn();
  const runtime = { getControlsSnapshot: () => controlsSnapshot({ ...idleSnapshot(), runId: 'run-1' }, 'Ctrl + Alt + Shift + Escape'),
    controller: { stop, pause: vi.fn(), resume: vi.fn() } } as unknown as TaskRuntime;
  const open = vi.fn();
  const dispose = registerControlsIpc(window, frame.url, runtime, open);
  const handlers = new Map(vi.mocked(ipcMain.handle).mock.calls.map(([channel, handler]) => [channel, handler]));
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  return { handlers, event, stop, open, dispose };
}

describe('floating controls boundary', () => {
  it('excludes screenshots, goals, typed text, and model metadata from the controls snapshot', () => {
    const state = { ...idleSnapshot(), goal: 'private goal', screenshot: 'private screenshot', message: 'private action text' };
    expect(controlsSnapshot(state, 'Ctrl + Alt + Shift + Escape')).toEqual({ runId: null, revision: 0, status: 'idle', executed: 0, maxSteps: 15, canResume: false, emergencyStopShortcut: 'Ctrl + Alt + Shift + Escape' });
    expect(JSON.stringify(controlsSnapshot(state, null))).not.toContain('private');
  });

  it('reports the selected shortcut through the restricted controls bridge', () => {
    const { handlers, event } = setup();
    expect(handlers.get(IPC_CHANNELS.controlsSnapshot)!(event)).toMatchObject({ emergencyStopShortcut: 'Ctrl + Alt + Shift + Escape' });
  });

  it('allows the trusted controls frame to stop a specific run without exposing task creation or credentials', () => {
    const { handlers, event, stop } = setup();
    handlers.get(IPC_CHANNELS.controlsStop)!(event, 'run-1');
    expect(stop).toHaveBeenCalledWith('run-1');
    expect(handlers.has(IPC_CHANNELS.startTask)).toBe(false);
    expect(handlers.has(IPC_CHANNELS.testModelConnection)).toBe(false);
  });

  it('rejects a different window, subframe, URL, extra arguments, and invalid run IDs', () => {
    const { handlers, event, stop } = setup();
    const handler = handlers.get(IPC_CHANNELS.controlsStop)!;
    for (const badEvent of [
      { ...event, sender: {} }, { ...event, senderFrame: { url: 'file:///app/controls.html' } },
      { ...event, senderFrame: { url: 'https://untrusted.example' } },
    ]) expect(() => handler(badEvent as IpcMainInvokeEvent, 'run-1')).toThrow('Rejected');
    expect(() => handler(event, 'run-1', 'extra')).toThrow('Rejected');
    expect(() => handler(event, '../other')).toThrow('Invalid run');
    expect(stop).not.toHaveBeenCalled();
  });

  it('unregisters every handler on shutdown', () => {
    const { handlers, dispose } = setup();
    dispose();
    expect(vi.mocked(ipcMain.removeHandler).mock.calls.map(([channel]) => channel).sort()).toEqual([...handlers.keys()].sort());
  });
});
