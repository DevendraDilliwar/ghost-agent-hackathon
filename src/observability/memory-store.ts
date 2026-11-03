import { FileOperations, writeAtomic } from './file-operations';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Durable cross-task memory. One JSON file (<baseDir>/memory.json), atomic
 * writes, bounded reads. Every method is total — missing files, corrupt
 * JSON and oversized payloads yield [] instead of throwing. Strict record
 * validation lives with the reader (CrossTaskMemory.restore), not here.
 */
export class MemoryStore {
  private readonly operations = new FileOperations();
  get healthy(): boolean { return this.operations.healthy; }
  drain(): Promise<void> { return this.operations.drain(); }

  constructor(private readonly baseDir: string) {}

  async load(): Promise<unknown> {
    try {
      const parsed: unknown = JSON.parse(await this.readBounded(join(this.baseDir, 'memory.json')));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async save(records: unknown): Promise<void> {
    try {
      await this.writeJson(this.baseDir, 'memory.json', records);
    } catch {
      // Best-effort; the live run continues without persistence.
    }
  }

  private async writeJson(directory: string, file: string, value: unknown): Promise<void> {
    const target = join(directory, file);
    await this.operations.enqueue(target, () => writeAtomic(target, JSON.stringify(value)));
  }

  private async readBounded(file: string): Promise<string> {
    const data = await readFile(file, 'utf8');
    if (data.length > 262_144) throw new Error('Cross-task memory too large.');
    return data;
  }
}
