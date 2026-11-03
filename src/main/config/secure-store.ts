import { app, safeStorage } from 'electron';
import { readFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { FileOperations, writeAtomic } from '../../observability/file-operations';
import { join } from 'node:path';
import os from 'node:os';

function getStoragePath(): string {
  try {
    return join(app.getPath('userData'), 'nomcp_credentials.enc');
  } catch {
    // In headless or test runner where app.getPath might not be initialized
    return join(os.tmpdir(), '.nomcp_credentials.enc');
  }
}

const operations = new FileOperations();

function assertProtectedStorage(): void {
  if (!safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
    throw new Error('Protected key storage is unavailable. Use a session-only key.');
  }
}

export async function hasStoredApiKey(filePath = getStoragePath()): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function saveStoredApiKey(key: string, filePath = getStoragePath()): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await clearStoredApiKey(filePath);
    return;
  }

  await operations.enqueue(filePath, async () => {
    assertProtectedStorage();
    const encrypted = safeStorage.encryptString(trimmed);
    // Verify before replacing any legacy file; never silently downgrade.
    if (safeStorage.decryptString(encrypted) !== trimmed) throw new Error('Credential storage verification failed.');
    await writeAtomic(filePath, Buffer.concat([Buffer.from([0x00]), encrypted]));
  });
}

export async function loadStoredApiKey(filePath = getStoragePath()): Promise<string | null> {
  try {
    const data = await readFile(filePath);
    if (!data || data.length === 0) return null;

    // Legacy public-metadata encryption is never auto-loaded. Re-enter the key.
    if (data[0] === 0x01) return null;
    assertProtectedStorage();
    return safeStorage.decryptString(data[0] === 0x00 ? data.subarray(1) : data);
  } catch {
    return null;
  }
}

export async function clearStoredApiKey(filePath = getStoragePath()): Promise<void> {
  await operations.enqueue(filePath, () => rm(filePath, { force: true }));
}
