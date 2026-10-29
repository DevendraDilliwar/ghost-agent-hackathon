import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../shared/contracts/application';
import { IPC_CHANNELS } from '../shared/ipc/channels';
import type { TaskSnapshot } from '../shared/contracts/task';

const bridge: DesktopBridge = {
  getApplicationInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getApplicationInfo),
  getRuntimeReadiness: () => ipcRenderer.invoke(IPC_CHANNELS.getRuntimeReadiness),
  getModelConnection: () => ipcRenderer.invoke(IPC_CHANNELS.getModelConnection),
  testModelConnection: apiKey => ipcRenderer.invoke(IPC_CHANNELS.testModelConnection, apiKey),
  showFloatingControls: () => ipcRenderer.invoke(IPC_CHANNELS.showFloatingControls),
  getTaskSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getTaskSnapshot),
  startTask: configuration => ipcRenderer.invoke(IPC_CHANNELS.startTask, configuration),
  pauseTask: runId => ipcRenderer.invoke(IPC_CHANNELS.pauseTask, runId),
  takeOverTask: runId => ipcRenderer.invoke(IPC_CHANNELS.takeOverTask, runId),
  resumeTask: (runId, answer) => ipcRenderer.invoke(IPC_CHANNELS.resumeTask, runId, answer),
  stopTask: runId => ipcRenderer.invoke(IPC_CHANNELS.stopTask, runId),
  reviewAction: (runId, actionId, approve) => ipcRenderer.invoke(IPC_CHANNELS.reviewAction, runId, actionId, approve),
  confirmCompletion: (runId, verified) => ipcRenderer.invoke(IPC_CHANNELS.confirmCompletion, runId, verified),
  onTaskChanged: listener => {
    const handler = (_event: unknown, snapshot: TaskSnapshot) => listener(snapshot);
    ipcRenderer.on(IPC_CHANNELS.taskChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.taskChanged, handler);
  },
};

contextBridge.exposeInMainWorld('ghostAgent', Object.freeze(bridge));
