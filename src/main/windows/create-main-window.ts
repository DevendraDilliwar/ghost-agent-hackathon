import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, screen } from 'electron';
import { registerApplicationIpc } from '../ipc/register-application-ipc';
import { registerTaskIpc } from '../ipc/register-task-ipc';
import { registerControlsIpc } from '../ipc/register-controls-ipc';
import { createTaskRuntime } from '../runtime/create-task-runtime';
import { secureWindow, windowPreferences } from './secure-window';

export async function createMainWindow(): Promise<BrowserWindow> {
  const developmentUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
  const rendererFile = join(import.meta.dirname, '../renderer/index.html');
  const controlsFile = join(import.meta.dirname, '../renderer/controls.html');
  const rendererUrl = developmentUrl ?? pathToFileURL(rendererFile).href;
  const controlsUrl = developmentUrl ? new URL('controls.html', developmentUrl).href : pathToFileURL(controlsFile).href;
  const window = new BrowserWindow({
    width: 1080, height: 820, minWidth: 680, minHeight: 560, title: 'NoMCP - The Universal Worker', show: false,
    autoHideMenuBar: true, backgroundColor: '#06080f', webPreferences: windowPreferences('index'),
  });
  const area = screen.getPrimaryDisplay().workArea;
  const controls = new BrowserWindow({
    width: 440, height: 148, x: Math.max(area.x, area.x + area.width - 456), y: Math.max(area.y, area.y + area.height - 164),
    title: 'NoMCP HUD', show: false, frame: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#06080f', webPreferences: windowPreferences('controls'),
  });
  window.on('show', () => { if (!controls.isDestroyed()) controls.hide(); });
  secureWindow(window, Boolean(developmentUrl));
  secureWindow(controls, Boolean(developmentUrl));
  const runtime = createTaskRuntime(window, controls);
  const unregisterApplication = registerApplicationIpc(window, rendererUrl);
  const openTask = () => {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    controls.hide();
    window.show();
    window.focus();
  };
  const controlsLoaded = developmentUrl ? controls.loadURL(controlsUrl) : controls.loadFile(controlsFile);
  // Attach a rejection handler immediately; the combined load below owns cleanup.
  void controlsLoaded.catch(() => undefined);
  const unregisterTask = registerTaskIpc(window, rendererUrl, runtime, async () => {
    await controlsLoaded;
    if (window.isDestroyed() || controls.isDestroyed()) throw new Error('Task controls are unavailable.');
    controls.show();
    window.hide();
  });
  const unregisterControls = registerControlsIpc(controls, controlsUrl, runtime, openTask);
  controls.on('close', event => { event.preventDefault(); openTask(); });
  for (const surface of [window, controls]) surface.webContents.on('render-process-gone', () => {
    const task = runtime.controller.getSnapshot();
    if (task.runId) runtime.controller.stop(task.runId);
  });
  window.once('closed', () => {
    runtime.dispose();
    unregisterTask(); unregisterControls(); unregisterApplication();
    controls.destroy();
  });
  window.once('ready-to-show', () => window.show());
  try {
    await Promise.all([controlsLoaded, developmentUrl ? window.loadURL(rendererUrl) : window.loadFile(rendererFile)]);
  } catch (error) {
    window.destroy();
    throw error;
  }
  return window;
}
