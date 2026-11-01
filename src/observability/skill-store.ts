import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Durable skill library. One JSON file (<baseDir>/skills.json), atomic
 * writes, bounded reads. Every method is total — missing files, corrupt
 * JSON and oversized payloads yield [] instead of throwing, so a damaged
 * library can never crash the agent loop. Strict record validation lives
 * with the reader (SkillMemory.restore), not here.
 */
export class SkillStore {
  constructor(private readonly baseDir: string) {}

  async load(): Promise<unknown> {
    try {
      const parsed: unknown = JSON.parse(await this.readBounded(join(this.baseDir, 'skills.json')));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async save(skills: unknown): Promise<void> {
    try {
      await this.writeJson(this.baseDir, 'skills.json', skills);
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
    if (data.length > 262_144) throw new Error('Skill library too large.');
    return data;
  }
}
