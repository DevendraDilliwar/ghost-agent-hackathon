import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { assertTrustedSender, readRunId } from './assert-sender';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { TaskRuntime } from '../runtime/create-task-runtime';

export function registerControlsIpc(window: BrowserWindow, rendererUrl: string, runtime: TaskRuntime, openTask: () => void): () => void {
  const channels: string[] = [];
  function handle(channel: string, count: number, invoke: (args: unknown[]) => unknown) {
    channels.push(channel);
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      assertTrustedSender(event, window, rendererUrl, args, count);
      return invoke(args);
    });
  }
  handle(IPC_CHANNELS.controlsSnapshot, 0, () => runtime.getControlsSnapshot());
  handle(IPC_CHANNELS.controlsOpenTask, 0, openTask);
  handle(IPC_CHANNELS.controlsPause, 1, args => { runtime.controller.pause(readRunId(args[0])); });
  handle(IPC_CHANNELS.controlsResume, 1, args => { runtime.controller.resume(readRunId(args[0])); });
  handle(IPC_CHANNELS.controlsStop, 1, args => { runtime.controller.stop(readRunId(args[0])); });
  return () => { for (const channel of channels) ipcMain.removeHandler(channel); };
}
