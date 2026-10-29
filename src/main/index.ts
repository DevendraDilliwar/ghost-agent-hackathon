import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/create-main-window';
import { loadDevelopmentEnvironment } from './config/load-environment';

let mainWindow: BrowserWindow | null = null;

async function openMainWindow(): Promise<void> {
  try {
    mainWindow = await createMainWindow();
  } catch (error) {
    console.error('Ghost Agent could not open its window.', error);
    app.exit(1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });

  app.whenReady().then(async () => {
    loadDevelopmentEnvironment();
    await openMainWindow();

    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) void openMainWindow();
    });
  }).catch((error: unknown) => {
    console.error('Ghost Agent could not initialize.', error);
    app.exit(1);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
