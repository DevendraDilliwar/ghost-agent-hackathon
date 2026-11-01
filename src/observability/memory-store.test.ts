import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';

const mistake = { domain: 'gcp', reason: 'Stuck on billing.', createdAt: 1 };

describe('memory store', () => {
  it('round-trips mistakes through one JSON file', async () => {
    const store = new MemoryStore(mkdtempSync(join(tmpdir(), 'ghost-memory-')));
    await store.save([mistake]);
    await expect(store.load()).resolves.toEqual([mistake]);
  });

  it('yields no mistakes for missing or corrupt files', async () => {
    const missing = new MemoryStore(mkdtempSync(join(tmpdir(), 'ghost-memory-')));
    await expect(missing.load()).resolves.toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 'ghost-memory-'));
    writeFileSync(join(dir, 'memory.json'), '{not json');
    await expect(new MemoryStore(dir).load()).resolves.toEqual([]);
  });
});
