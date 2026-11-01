export interface MistakeRecord {
  readonly domain: string;
  readonly reason: string;
  readonly createdAt: number;
}

const maxMistakes = 30;
const maxReason = 300;

/**
 * Cross-task memory — past escalations per domain, surfaced so the next
 * run does not repeat them. Records only real handoffs (stalls, failed
 * commands, unmet phases), never user pauses or clarifications.
 */
export class CrossTaskMemory {
  private readonly mistakes: MistakeRecord[] = [];

  constructor(initial: readonly MistakeRecord[] = [], private readonly now: () => number = Date.now) {
    for (const record of initial) this.mistakes.push({ ...record });
  }

  /** Records an escalation. False when empty or already known. */
  recordMistake(domain: string, reason: string): boolean {
    const clean = reason.trim().slice(0, maxReason);
    if (!domain.trim() || !clean) return false;
    if (this.mistakes.some(entry => entry.domain === domain && entry.reason === clean)) return false;
    this.mistakes.push({ domain, reason: clean, createdAt: this.now() });
    if (this.mistakes.length > maxMistakes) this.mistakes.splice(0, this.mistakes.length - maxMistakes);
    return true;
  }

  /** Latest reasons for a domain, newest last. */
  mistakesFor(domain: string, limit = 2): string[] {
    return this.mistakes.filter(entry => entry.domain === domain).slice(-limit).map(entry => entry.reason);
  }

  /** Merges disk records in, skipping ones already known. */
  merge(records: readonly MistakeRecord[]): void {
    const known = new Set(this.mistakes.map(entry => entry.domain + '\0' + entry.reason));
    for (const record of records) {
      const key = record.domain + '\0' + record.reason;
      if (known.has(key)) continue;
      known.add(key);
      if (this.mistakes.length >= maxMistakes) this.mistakes.shift();
      this.mistakes.push({ ...record });
    }
  }

  serialize(): MistakeRecord[] {
    return this.mistakes.map(entry => ({ ...entry }));
  }

  static restore(records: unknown): CrossTaskMemory {
    if (!Array.isArray(records)) throw new Error('Invalid cross-task memory.');
    const clean: MistakeRecord[] = [];
    for (const entry of records) {
      if (!entry || typeof entry !== 'object') throw new Error('Invalid mistake record.');
      const record = entry as Record<string, unknown>;
      if (typeof record.domain !== 'string' || !record.domain.trim() ||
        typeof record.reason !== 'string' || !record.reason.trim() ||
        typeof record.createdAt !== 'number') {
        throw new Error('Invalid mistake record.');
      }
      clean.push({ domain: record.domain, reason: record.reason.slice(0, maxReason), createdAt: record.createdAt });
    }
    return new CrossTaskMemory(clean);
  }
}
