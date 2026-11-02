import { describe, expect, it } from 'vitest';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AttachmentStore } from './attachment-store';

const png = Buffer.from('fake-png-bytes').toString('base64');

async function freshStore(): Promise<AttachmentStore> {
  return new AttachmentStore(await mkdtemp(join(tmpdir(), 'nomcp-attachments-test-')));
}

describe('attachment store', () => {
  it('saves attachments and returns local refs with exact bytes', async () => {
    const store = await freshStore();
    const stored = await store.saveAttachments('run-1', [
      { name: 'bill.jpg', mime: 'image/jpeg', data: png },
      { name: 'sheet.png', mime: 'image/png', data: png },
    ]);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ mime: 'image/jpeg', size: Buffer.byteLength('fake-png-bytes') });
    expect(await readFile(stored[0]!.path, 'utf8')).toBe('fake-png-bytes');
    await store.pruneAttachments('run-1');
    await expect(access(stored[0]!.path)).rejects.toThrow();
  });

  it('sanitizes traversal names and keeps duplicates distinct', async () => {
    const store = await freshStore();
    const stored = await store.saveAttachments('run-2', [
      { name: '../../evil.png', mime: 'image/png', data: png },
      { name: 'a.png', mime: 'image/png', data: png },
      { name: 'a.png', mime: 'image/png', data: png },
    ]);
    expect(stored.map(file => file.name)).toEqual(['0-evil.png', '1-a.png', '2-a.png']);
    for (const file of stored) {
      expect(file.path).not.toContain('..');
      await expect(access(file.path)).resolves.toBeUndefined();
    }
  });

  it('rejects bad mime, oversize data, too many files, and bad run ids', async () => {
    const store = await freshStore();
    await expect(store.saveAttachments('run-3', [{ name: 'bill.gif', mime: 'image/gif', data: png }])).rejects.toThrow('PNG and JPEG');
    await expect(store.saveAttachments('run-3', [{ name: 'big.png', mime: 'image/png', data: 'A'.repeat(11_200_001) }])).rejects.toThrow('supported size');
    await expect(store.saveAttachments('run-3', [
      { name: '1.png', mime: 'image/png', data: png }, { name: '2.png', mime: 'image/png', data: png },
      { name: '3.png', mime: 'image/png', data: png }, { name: '4.png', mime: 'image/png', data: png },
    ])).rejects.toThrow('at most 3');
    await expect(store.saveAttachments('../escape', [{ name: 'a.png', mime: 'image/png', data: png }])).rejects.toThrow('Invalid run reference');
    await expect(store.pruneAttachments('../escape')).rejects.toThrow('Invalid run reference');
  });

  it('prunes missing runs silently', async () => {
    const store = await freshStore();
    await expect(store.pruneAttachments('ghost-run')).resolves.toBeUndefined();
  });
});
