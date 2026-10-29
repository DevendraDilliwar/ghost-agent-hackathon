import { join } from 'node:path';
import { app } from 'electron';

export function loadDevelopmentEnvironment(): void {
  if (app.isPackaged) return;
  try {
    process.loadEnvFile(join(app.getAppPath(), '.env.local'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
    // eslint-disable-next-line preserve-caught-error -- Parser details may contain credentials; do not propagate them to startup logs.
    throw new Error('Could not load the local development environment file.');
  }
}
