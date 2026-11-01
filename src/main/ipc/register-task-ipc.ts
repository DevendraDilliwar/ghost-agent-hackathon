import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { TaskRuntime } from '../runtime/create-task-runtime';
import { validateRunConfiguration } from '../../policy/task-validation';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { assertTrustedSender, readRunId } from './assert-sender';

export function registerTaskIpc(window: BrowserWindow, rendererUrl: string, runtime: TaskRuntime, showControls: () => Promise<void>): () => void {
  const channels: string[] = [];
  function handle(channel: string, count: number, invoke: (args: unknown[]) => unknown) {
    channels.push(channel);
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      assertTrustedSender(event, window, rendererUrl, args, count);
      return invoke(args);
    });
  }
  handle(IPC_CHANNELS.getTaskSnapshot, 0, () => runtime.controller.getSnapshot());
  handle(IPC_CHANNELS.getRuntimeReadiness, 0, () => runtime.readiness());
  handle(IPC_CHANNELS.getModelConnection, 0, () => runtime.connection.info());
  handle(IPC_CHANNELS.testModelConnection, 1, args => runtime.testConnection(args[0]));
  handle(IPC_CHANNELS.showFloatingControls, 0, showControls);
  handle(IPC_CHANNELS.startTask, 1, async args => {
    const configuration = validateRunConfiguration(args[0]);
    const readiness = await runtime.readiness();
    if (!readiness.ready) throw new Error(readiness.issues.join(' '));
    return runtime.start(configuration);
  });
  handle(IPC_CHANNELS.pauseTask, 1, args => runtime.controller.pause(readRunId(args[0])));
  handle(IPC_CHANNELS.takeOverTask, 1, args => runtime.controller.takeOver(readRunId(args[0])));
  handle(IPC_CHANNELS.resumeTask, 2, args => {
    if (args[1] !== null && (typeof args[1] !== 'string' || args[1].length > 1000 || args[1].includes('\0'))) throw new Error('Invalid clarification.');
    return runtime.controller.resume(readRunId(args[0]), args[1] === null ? undefined : args[1] as string);
  });
  handle(IPC_CHANNELS.stopTask, 1, args => runtime.controller.stop(readRunId(args[0])));
  handle(IPC_CHANNELS.reviewAction, 3, args => {
    if (typeof args[2] !== 'boolean') throw new Error('Invalid action review.');
    return runtime.controller.review(readRunId(args[0]), readRunId(args[1]), args[2]);
  });
  handle(IPC_CHANNELS.confirmCompletion, 2, args => {
    if (typeof args[1] !== 'boolean') throw new Error('Invalid completion decision.');
    return runtime.controller.confirm(readRunId(args[0]), args[1]);
  });
  handle(IPC_CHANNELS.listMissions, 0, () => runtime.listMissions());
  handle(IPC_CHANNELS.listRuns, 0, () => runtime.listRuns());
  handle(IPC_CHANNELS.getRun, 1, args => runtime.loadRun(readRunId(args[0])));
  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
