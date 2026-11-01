import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Durable cross-task memory. One JSON file (<baseDir>/memory.json), atomic
 * writes, bounded reads. Every method is total — missing files, corrupt
 * JSON and oversized payloads yield [] instead of throwing. Strict record
 * validation lives with the reader (CrossTaskMemory.restore), not here.
 */
export class MemoryStore {
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
    await mkdir(directory, { recursive: true });
    const target = join(directory, file);
    const tmp = target + '.tmp';
    await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await rename(tmp, target);
  }

  private async readBounded(file: string): Promise<string> {
    const data = await readFile(file, 'utf8');
    if (data.length > 262_144) throw new Error('Cross-task memory too large.');
    return data;
  }
}
