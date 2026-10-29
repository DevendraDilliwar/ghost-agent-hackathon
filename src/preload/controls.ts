import { contextBridge, ipcRenderer } from 'electron';
import type { FloatingControlsBridge, ControlsSnapshot } from '../shared/contracts/controls';
import type { IPC_CHANNELS as ChannelContract } from '../shared/ipc/channels';

// Keep this sandboxed entry self-contained: a shared emitted chunk cannot be required by Electron's sandbox.
const IPC_CHANNELS = {
  controlsSnapshot: 'controls:get-snapshot', controlsPause: 'controls:pause', controlsResume: 'controls:resume',
  controlsStop: 'controls:stop', controlsOpenTask: 'controls:open-task', controlsChanged: 'controls:changed',
} satisfies Pick<typeof ChannelContract, 'controlsSnapshot' | 'controlsPause' | 'controlsResume' | 'controlsStop' | 'controlsOpenTask' | 'controlsChanged'>;

const bridge: FloatingControlsBridge = {
  getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.controlsSnapshot),
  pause: runId => ipcRenderer.invoke(IPC_CHANNELS.controlsPause, runId),
  resume: runId => ipcRenderer.invoke(IPC_CHANNELS.controlsResume, runId),
  stop: runId => ipcRenderer.invoke(IPC_CHANNELS.controlsStop, runId),
  openTask: () => ipcRenderer.invoke(IPC_CHANNELS.controlsOpenTask),
  onChanged: listener => {
    const handler = (_event: unknown, snapshot: ControlsSnapshot) => listener(snapshot);
    ipcRenderer.on(IPC_CHANNELS.controlsChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.controlsChanged, handler);
  },
};
contextBridge.exposeInMainWorld('ghostControls', Object.freeze(bridge));
