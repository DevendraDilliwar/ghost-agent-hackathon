import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
    getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str: string) => Buffer.from('mock-encrypted:' + str)),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace('mock-encrypted:', '')),
  },
}));

import { saveStoredApiKey, loadStoredApiKey, clearStoredApiKey, hasStoredApiKey } from './secure-store';

describe('secure credential store', () => {
  const testFile = join(tmpdir(), `test_nomcp_cred_${Date.now()}.enc`);

  beforeEach(async () => {
    await clearStoredApiKey(testFile);
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue('gnome_libsecret');
  });

  afterEach(async () => {
    await clearStoredApiKey(testFile);
  });

  it('saves, verifies existence, and loads an encrypted API key correctly', async () => {
    expect(await hasStoredApiKey(testFile)).toBe(false);
    expect(await loadStoredApiKey(testFile)).toBe(null);

    const secretKey = 'meta-sk-live-test123456789';
    await saveStoredApiKey(secretKey, testFile);

    expect(await hasStoredApiKey(testFile)).toBe(true);
    const loaded = await loadStoredApiKey(testFile);
    expect(loaded).toBe(secretKey);
  });

  it('clears stored key cleanly', async () => {
    await saveStoredApiKey('key-to-delete', testFile);
    expect(await hasStoredApiKey(testFile)).toBe(true);

    await clearStoredApiKey(testFile);
    expect(await hasStoredApiKey(testFile)).toBe(false);
    expect(await loadStoredApiKey(testFile)).toBe(null);
  });

  it('saving empty string clears the stored key', async () => {
    await saveStoredApiKey('initial-key', testFile);
    expect(await hasStoredApiKey(testFile)).toBe(true);

    await saveStoredApiKey('', testFile);
    expect(await hasStoredApiKey(testFile)).toBe(false);
  });
  it('refuses remembering without protected native encryption and preserves old bytes', async () => {
    await writeFile(testFile, Buffer.from([1, 2, 3]));
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(saveStoredApiKey('dummy-new-key', testFile)).rejects.toThrow('session-only');
    expect(await readFile(testFile)).toEqual(Buffer.from([1, 2, 3]));
    expect(await loadStoredApiKey(testFile)).toBeNull();
  });

  it('rejects basic_text and never falls back after native encryption throws', async () => {
    vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue('basic_text');
    await expect(saveStoredApiKey('dummy', testFile)).rejects.toThrow('session-only');
    vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue('gnome_libsecret');
    vi.mocked(safeStorage.encryptString).mockImplementationOnce(() => { throw new Error('keyring unavailable'); });
    await expect(saveStoredApiKey('dummy', testFile)).rejects.toThrow('keyring unavailable');
    expect(await hasStoredApiKey(testFile)).toBe(false);
  });

  it('never auto-loads legacy weak records and replaces only after protected encryption succeeds', async () => {
    await writeFile(testFile, Buffer.from([1, 99, 98]));
    expect(await loadStoredApiKey(testFile)).toBeNull();
    await saveStoredApiKey('replacement-dummy', testFile);
    expect((await readFile(testFile))[0]).toBe(0);
    expect(await loadStoredApiKey(testFile)).toBe('replacement-dummy');
  });

});
