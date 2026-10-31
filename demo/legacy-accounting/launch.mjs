import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    title: 'TallyPrime Gold - [Voucher Entry: Sales (F8)]',
    autoHideMenuBar: true,
    backgroundColor: '#0b2b1a',
  });

  void win.loadFile(join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
