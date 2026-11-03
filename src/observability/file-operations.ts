import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Orders complete operations, including read/modify/write and deletion. */
export class FileOperations {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly failures = new Set<string>();

  get healthy(): boolean { return this.failures.size === 0; }

  enqueue<T>(target: string, work: () => Promise<T>): Promise<T> {
    const result = (this.tails.get(target) ?? Promise.resolve()).then(work);
    const tail = result.then(() => { this.failures.delete(target); }, () => {
      this.failures.add(target);
    });
    this.tails.set(target, tail);
    void tail.then(() => {
      if (this.tails.get(target) === tail) this.tails.delete(target);
    });
    return result;
  }

  async drain(): Promise<void> {
    while (this.tails.size) await Promise.all([...this.tails.values()]);
  }
}

/** Unique private temp file; a failed replacement leaves the previous file intact. */
export async function writeAtomic(target: string, bytes: string | Uint8Array): Promise<void> {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}
