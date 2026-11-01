import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunHistoryStore, toRunRecord } from './run-history-store';
import type { TaskSnapshot } from '../shared/contracts/task';

function snapshot(overrides?: Partial<TaskSnapshot>): TaskSnapshot {
  return {
    runId: 'run-1', revision: 3, status: 'acting', goal: 'Do the thing', maxSteps: 25, maxMinutes: 5,
    actions: [{ id: 'a-1', type: 'click', description: 'Click the target', timestamp: 't', status: 'executed' }],
    messages: [{ id: 'm-1', sender: 'user', content: 'Do the thing', timestamp: 't' }],
    screenshot: null, pendingActionId: null, message: 'Working on it.',
    awaitingCompletion: false, handoff: null, inputTokens: 10, outputTokens: 5, intent: null, mission: null,
    ...overrides,
  };
}

function storedRecord(runId: string, updatedAt: number): Record<string, unknown> {
  return {
    runId, goal: 'Goal ' + runId, status: 'completed', message: 'done',
    messages: [{ id: 'm-1', sender: 'user', content: 'hi', timestamp: 't' }], actions: [],
    inputTokens: 1, outputTokens: 2, maxSteps: 25, maxMinutes: 5,
    missionId: null, resumable: false, mission: null, createdAt: 1, updatedAt,
  };
}

describe('RunHistoryStore', () => {
  it('round-trips run records and keeps the first createdAt', async () => {
    const store = new RunHistoryStore(await mkdtemp(join(tmpdir(), 'nomcp-history-')));
    const record = toRunRecord(snapshot({}))!;
    await store.saveRun(record);
    const first = await store.loadRun('run-1');
    expect(first).toMatchObject({ runId: 'run-1', goal: 'Do the thing', status: 'acting' });
    expect(first!.createdAt).toBeLessThanOrEqual(first!.updatedAt);
    await store.saveRun({ ...record, status: 'completed' });
    const second = await store.loadRun('run-1');
    expect(second!.status).toBe('completed');
    expect(second!.createdAt).toBe(first!.createdAt);
    expect(second!.updatedAt).toBeGreaterThanOrEqual(first!.updatedAt);
  });

  it('redacts screenshots, typed text, coordinates, and evidence images', async () => {
    const record = toRunRecord(snapshot({
      screenshot: 'data:image/png;base64,AAA',
      messages: [{ id: 'm-1', sender: 'agent', content: 'done', timestamp: 't', verificationImage: 'data:image/png;base64,BBB' }],
      actions: [{
        id: 'a-1', type: 'type', description: 'Type the password', text: 's3cret', coordinates: { x: 1, y: 2 },
        timestamp: 't', status: 'executed',
      }],
    }))!;
    expect(record).toMatchObject({ messages: [{ id: 'm-1', content: 'done' }] });
    expect(record.messages[0]).not.toHaveProperty('verificationImage');
    expect(record.actions[0]).not.toHaveProperty('text');
    expect(record.actions[0]).not.toHaveProperty('coordinates');
    expect(JSON.stringify(record)).not.toContain('s3cret');
    expect(JSON.stringify(record)).not.toContain('base64');
    expect(toRunRecord(snapshot({ runId: null }))).toBeNull();
    expect(toRunRecord(snapshot({ runId: '../escape' }))).toBeNull();
  });

  it('returns null for missing, corrupt, or mismatched records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-history-'));
    const store = new RunHistoryStore(directory);
    expect(await store.loadRun('run-1')).toBeNull();
    await writeFile(join(directory, 'run-1.json'), 'not-json{{{');
    expect(await store.loadRun('run-1')).toBeNull();
    await writeFile(join(directory, 'run-1.json'), JSON.stringify(storedRecord('other-id', 5)));
    expect(await store.loadRun('run-1')).toBeNull();
    expect(await store.listRuns()).toEqual([]);
  });

  it('rejects unsafe ids without writing outside the base directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-history-'));
    const store = new RunHistoryStore(directory);
    await store.saveRun({ ...(toRunRecord(snapshot({}))!), runId: '../escape' });
    expect(await store.loadRun('../escape')).toBeNull();
    expect(await store.listRuns()).toEqual([]);
  });

  it('never throws on unwritable locations', async () => {
    const blocker = join(await mkdtemp(join(tmpdir(), 'nomcp-history-')), 'blocker');
    await writeFile(blocker, 'x');
    const store = new RunHistoryStore(join(blocker, 'nested'));
    await expect(store.saveRun(toRunRecord(snapshot({}))!)).resolves.toBeUndefined();
    await expect(store.loadRun('run-1')).resolves.toBeNull();
    await expect(store.listRuns()).resolves.toEqual([]);
  });

  it('lists runs newest-first, skips invalid entries, and caps at 50', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-history-'));
    const store = new RunHistoryStore(directory);
    await writeFile(join(directory, 'r-old.json'), JSON.stringify(storedRecord('r-old', 10)));
    await writeFile(join(directory, 'r-new.json'), JSON.stringify(storedRecord('r-new', 20)));
    await writeFile(join(directory, 'junk.txt'), 'ignored');
    await writeFile(join(directory, 'bad.json'), 'not-json');
    expect((await store.listRuns()).map(run => run.runId)).toEqual(['r-new', 'r-old']);
    for (let index = 0; index < 55; index++) {
      await writeFile(join(directory, `r-${index}.json`), JSON.stringify(storedRecord(`r-${index}`, 100 + index)));
    }
    const capped = await store.listRuns();
    expect(capped).toHaveLength(50);
    expect(capped[0]!.runId).toBe('r-54');
  });
});
