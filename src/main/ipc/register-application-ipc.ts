import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { getDesktopSession } from '../../desktop/session-info';
import { isTrustedRenderer } from '../../policy/trusted-renderer';
import type { ApplicationInfo } from '../../shared/contracts/application';
import { IPC_CHANNELS } from '../../shared/ipc/channels';

export function registerApplicationIpc(window: BrowserWindow, rendererUrl: string): () => void {
  ipcMain.handle(IPC_CHANNELS.getApplicationInfo, (event, ...args: unknown[]): ApplicationInfo => {
    if (
      args.length !== 0 ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isTrustedRenderer(event.senderFrame.url, rendererUrl)
    ) {
      throw new Error('Rejected application info request.');
    }

    return {
      name: 'Ghost Agent',
      version: app.getVersion(),
      platform: process.platform,
      desktopSession: getDesktopSession(process.env.XDG_SESSION_TYPE),
      automationReady: false,
    };
  });

  return () => ipcMain.removeHandler(IPC_CHANNELS.getApplicationInfo);
}
