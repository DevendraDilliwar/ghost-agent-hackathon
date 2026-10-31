import { app, safeStorage } from 'electron';
import { readFile, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { scryptSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
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

// Fallback AES-256-GCM cipher if native OS keychain is unavailable
function fallbackEncrypt(text: string): Buffer {
  const salt = Buffer.from('nomcp-local-credential-store-v1');
  const key = scryptSync(os.hostname() + (os.userInfo()?.username ?? 'user'), salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [1 byte mode 0x01][12 bytes IV][16 bytes Tag][encrypted data]
  return Buffer.concat([Buffer.from([0x01]), iv, tag, encrypted]);
}

function fallbackDecrypt(data: Buffer): string {
  if (data.length < 30 || data[0] !== 0x01) {
    throw new Error('Invalid fallback encrypted credential format.');
  }
  const salt = Buffer.from('nomcp-local-credential-store-v1');
  const key = scryptSync(os.hostname() + (os.userInfo()?.username ?? 'user'), salt, 32);
  const iv = data.subarray(1, 13);
  const tag = data.subarray(13, 29);
  const text = data.subarray(29);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(text, undefined, 'utf8') + decipher.final('utf8');
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

  let buffer: Buffer;
  try {
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      // OS Native DPAPI / Keychain (Mode 0x00)
      const encrypted = safeStorage.encryptString(trimmed);
      buffer = Buffer.concat([Buffer.from([0x00]), encrypted]);
    } else {
      buffer = fallbackEncrypt(trimmed);
    }
  } catch {
    buffer = fallbackEncrypt(trimmed);
  }

  await writeFile(filePath, buffer, { mode: 0o600 });
}

export async function loadStoredApiKey(filePath = getStoragePath()): Promise<string | null> {
  try {
    const data = await readFile(filePath);
    if (!data || data.length === 0) return null;

    const mode = data[0];
    if (mode === 0x00 && safeStorage && typeof safeStorage.decryptString === 'function') {
      // Decrypt using native OS DPAPI / Keychain
      return safeStorage.decryptString(data.subarray(1));
    }
    if (mode === 0x01) {
      return fallbackDecrypt(data);
    }
    // Attempt native decrypt directly if legacy format
    if (safeStorage && typeof safeStorage.decryptString === 'function') {
      return safeStorage.decryptString(data);
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearStoredApiKey(filePath = getStoragePath()): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // Ignore deletion errors if file doesn't exist
  }
}
