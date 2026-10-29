import { join } from 'node:path';
import type { BrowserWindow, WebPreferences } from 'electron';
import { getContentSecurityPolicy } from '../../policy/trusted-renderer';

export function windowPreferences(preload: 'index' | 'controls'): WebPreferences {
  return { preload: join(import.meta.dirname, '../preload/' + preload + '.cjs'), contextIsolation: true,
    sandbox: true, nodeIntegration: false, webSecurity: true, webviewTag: false, partition: 'ghost-agent' };
}

export function secureWindow(window: BrowserWindow, development: boolean): void {
  const session = window.webContents.session;
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [getContentSecurityPolicy(development)] } });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}
