import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
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
});
