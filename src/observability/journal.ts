import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { JournalEvent, JournalSink } from '../shared/contracts/journal';

const runIdPattern = /^[A-Za-z0-9-]{1,80}$/;

/**
 * File-backed journal: one JSONL file per run under a directory.
 * Writes are serialized per file through a promise chain; every failure
 * (missing dir, permissions, bad runId) is swallowed by design.
 */
export class FileJournal implements JournalSink {
  private readonly chains = new Map<string, Promise<void>>();
  private readonly ready: Promise<void>;

  constructor(private readonly directory: string) {
    this.ready = mkdir(directory, { recursive: true }).then(
      () => undefined,
      () => undefined,
    );
  }

  append(event: JournalEvent): void {
    try {
      if (!runIdPattern.test(event.runId)) return;
      const file = join(this.directory, event.runId + '.jsonl');
      const line = JSON.stringify(event) + '\n';
      const prior = this.chains.get(file) ?? this.ready;
      const next = prior
        .then(() => appendFile(file, line, { mode: 0o600 }))
        .then(
          () => undefined,
          () => undefined,
        );
      this.chains.set(file, next);
    } catch {
      // Journaling must never break the agent loop.
    }
  }

  /** Resolves when all queued writes settle. Used by tests and shutdown. */
  async drain(): Promise<void> {
    await Promise.all([...this.chains.values(), this.ready]);
  }
}

/** In-memory sink for tests and for runtimes that opt out of disk writes. */
export class InMemoryJournal implements JournalSink {
  readonly events: JournalEvent[] = [];

  append(event: JournalEvent): void {
    this.events.push(event);
  }
}
