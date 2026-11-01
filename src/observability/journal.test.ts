import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalEvent, redactSummary } from '../shared/contracts/journal';
import { FileJournal, InMemoryJournal } from './journal';

const base = {
  missionId: 'm-1', runId: 'run-1', stage: 'verify' as const, outcome: 'success' as const,
};
const nul = String.fromCharCode(0);

describe('journal redaction', () => {
  it('strips embedded screenshot data URLs from summaries', () => {
    const dirty = 'clicked then saw data:image/png;base64,aGVsbG8gd29ybGQ= inline';
    expect(redactSummary(dirty)).toBe('clicked then saw [image] inline');
    expect(redactSummary(dirty)).not.toContain('aGVsbG8');
  });

  it('truncates long summaries and strips NUL characters', () => {
    expect(redactSummary('x'.repeat(600))).toHaveLength(500);
    expect(redactSummary('ab' + nul + 'cd')).toBe('abcd');
  });

  it('fills timestamp and null phase/step defaults', () => {
    const event = createJournalEvent({ ...base, summary: 'ok' });
    expect(event.phaseId).toBeNull();
    expect(event.stepId).toBeNull();
    expect(event.ts).toBeLessThanOrEqual(Date.now());
  });
});

describe('InMemoryJournal', () => {
  it('collects appended events in order', () => {
    const journal = new InMemoryJournal();
    journal.append(createJournalEvent({ ...base, summary: 'first' }));
    journal.append(createJournalEvent({ ...base, summary: 'second' }));
    expect(journal.events.map(event => event.summary)).toEqual(['first', 'second']);
  });
});

describe('FileJournal', () => {
  it('writes one parseable JSON object per line', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-journal-'));
    const journal = new FileJournal(directory);
    journal.append(createJournalEvent({ ...base, summary: 'first', inputTokens: 10 }));
    journal.append(createJournalEvent({ ...base, summary: 'second', inputTokens: 20 }));
    await journal.drain();
    const lines = (await readFile(join(directory, 'run-1.jsonl'), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines.map(line => JSON.parse(line).summary)).toEqual(['first', 'second']);
    expect(JSON.parse(lines[1]!).inputTokens).toBe(20);
  });

  it('ignores events with unsafe runIds instead of writing outside the directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-journal-'));
    const journal = new FileJournal(directory);
    journal.append(createJournalEvent({ ...base, runId: '../../escape', summary: 'evil' }));
    await journal.drain();
    expect(await readdir(directory)).toEqual([]);
  });

  it('never throws when the directory is unwritable', async () => {
    const blocker = join(await mkdtemp(join(tmpdir(), 'nomcp-journal-')), 'blocker');
    await writeFile(blocker, 'x');
    const journal = new FileJournal(join(blocker, 'nested'));
    expect(() => {
      journal.append(createJournalEvent({ ...base, summary: 'lost but harmless' }));
    }).not.toThrow();
    await expect(journal.drain()).resolves.toBeUndefined();
  });
});
