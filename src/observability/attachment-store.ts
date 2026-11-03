import { FileOperations } from './file-operations';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunAttachmentInput, StoredAttachment } from '../shared/contracts/task';

/**
 * Chat attachment storage for photo-to-entry runs.
 *
 * The renderer sends base64; this store persists validated bytes under one
 * directory per run and hands local refs to the source reader (Phase 2).
 * Bounds mirror validateRunConfiguration so a bypassed validator still fails
 * here. Pruning rides with the run lifecycle from the Phase 2 hookup.
 */
const MAX_FILES = 3;
const MAX_BYTES = 8_000_000;

function sanitizeName(name: string, index: number): string {
  const segments = name.replace(/\\/g, '/').split('/');
  const base = segments[segments.length - 1] ?? 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 100);
  return index + '-' + (cleaned || 'file');
}

export class AttachmentStore {
  private readonly operations = new FileOperations();
  get healthy(): boolean { return this.operations.healthy; }
  drain(): Promise<void> { return this.operations.drain(); }
  constructor(private readonly root: string) {}

  saveAttachments(runId: string, files: readonly RunAttachmentInput[]): Promise<StoredAttachment[]> {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(runId)) return Promise.reject(new Error('Invalid run reference.'));
    return this.operations.enqueue(join(this.root, runId), () => this.writeAttachments(runId, files));
  }

  /** Persists validated chat attachments for one run. Returns local refs for the reader. */
  private async writeAttachments(runId: string, files: readonly RunAttachmentInput[]): Promise<StoredAttachment[]> {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(runId)) throw new Error('Invalid run reference.');
    if (files.length > MAX_FILES) throw new Error('Attach at most 3 images.');
    const dir = join(this.root, runId);
    await mkdir(dir, { recursive: true });
    const stored: StoredAttachment[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index]!;
      if (file.mime !== 'image/png' && file.mime !== 'image/jpeg') throw new Error('Only PNG and JPEG attachments are supported.');
      const bytes = Buffer.from(file.data, 'base64');
      if (bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) throw new Error('Attachment exceeds the supported size.');
      const name = sanitizeName(file.name, index);
      const path = join(dir, name);
      await writeFile(path, bytes, { mode: 0o600 });
      stored.push({ name, mime: file.mime, size: bytes.byteLength, path });
    }
    return stored;
  }

  /** Removes a run's attachments. Missing directories are a no-op. */
  async pruneAttachments(runId: string): Promise<void> {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(runId)) throw new Error('Invalid run reference.');
    const target = join(this.root, runId);
    await this.operations.enqueue(target, () => rm(target, { recursive: true, force: true }));
  }
}
