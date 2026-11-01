import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/create-main-window';
import { loadDevelopmentEnvironment } from './config/load-environment';
import { runEvalCli } from './eval/eval-runner';

let mainWindow: BrowserWindow | null = null;

async function openMainWindow(): Promise<void> {
  try {
    mainWindow = await createMainWindow();
  } catch (error) {
    console.error('Ghost Agent could not open its window.', error);
    app.exit(1);
  }
}

if (process.argv.includes('--eval')) {
  if (!app.requestSingleInstanceLock()) {
    console.error('Ghost Agent is already running. Close it before eval: two drivers fight over one desktop.');
    app.exit(2);
  } else {
    app.whenReady().then(async () => {
      loadDevelopmentEnvironment();
      app.exit(await runEvalCli());
    }).catch((error: unknown) => {
      console.error('Ghost eval crashed.', error);
      app.exit(1);
    });
  }
} else if (!app.requestSingleInstanceLock()) {
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

  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
  }

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
