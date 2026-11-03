import { describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileOperations, writeAtomic } from './file-operations';
import { RunHistoryStore } from './run-history-store';
import { CheckpointStore } from './checkpoint-store';

// Only synthetic temporary profiles; no application data or credentials.
describe('ordered atomic persistence', () => {
  it('holds later work until an older operation settles, then drains and recovers after a failure', async () => {
    const files = new FileOperations();
    const order: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = files.enqueue('target', async () => { order.push(1); await gate; order.push(2); });
    const second = files.enqueue('target', async () => { order.push(3); });
    await Promise.resolve();
    expect(order).toEqual([1]);
    release();
    await Promise.all([first, second, files.drain()]);
    expect(order).toEqual([1, 2, 3]);
    await expect(files.enqueue('target', async () => { throw new Error('simulated storage failure'); })).rejects.toThrow();
    expect(files.healthy).toBe(false);
    await files.enqueue('target', async () => undefined);
    expect(files.healthy).toBe(true);
  });

  it('uses unique temp files and leaves no temporary residue after replacement failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'atomic-hardening-'));
    const target = join(root, 'record.json');
    await writeAtomic(target, 'old');
    await writeAtomic(target, 'new');
    expect(await readFile(target, 'utf8')).toBe('new');
    expect(await readdir(root)).toEqual(['record.json']);
    const directoryTarget = join(root, 'blocked');
    await import('node:fs/promises').then(fs => fs.mkdir(directoryTarget));
    await expect(writeAtomic(directoryTarget, 'cannot replace directory')).rejects.toThrow();
    expect((await readdir(root)).some(name => name.endsWith('.tmp'))).toBe(false);
  });

  it('restores synthetic history and mission data from a closed-profile backup without executing anything', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'ghost-profile-'));
    const history = new RunHistoryStore(join(profile, 'history'));
    const checkpoints = new CheckpointStore(join(profile, 'missions'));
    await history.saveRun({ runId: 'synthetic-run', goal: 'Synthetic recovery', status: 'stopped', missionId: 'synthetic-run', resumable: true, message: 'Stopped', messages: [], actions: [], maxSteps: 25, maxMinutes: 5, inputTokens: 1, outputTokens: 1, mission: null });
    await checkpoints.saveMission({ missionId: 'synthetic-run', goal: 'Synthetic recovery', createdAt: 1 });
    await checkpoints.save({ missionId: 'synthetic-run', phaseId: 'phase-1', domain: 'shared', order: 0, goal: 'Synthetic phase', status: 'active', notes: [], steps: [], success: '', intent: null, clarifications: [], executedDescs: [], lastVerification: null, inputTokens: 1, outputTokens: 1, noProgressStreak: 0, savedAt: 1 });
    await Promise.all([history.drain(), checkpoints.drain()]);
    const backup = join(await mkdtemp(join(tmpdir(), 'ghost-backup-')), 'profile');
    await cp(profile, backup, { recursive: true });
    const restored = join(await mkdtemp(join(tmpdir(), 'ghost-restored-')), 'profile');
    await cp(backup, restored, { recursive: true });
    expect(await new RunHistoryStore(join(restored, 'history')).loadRun('synthetic-run')).toMatchObject({ status: 'stopped' });
    const restoredMissions = new CheckpointStore(join(restored, 'missions'));
    expect(await restoredMissions.load('synthetic-run', 'phase-1')).toMatchObject({ status: 'active' });
    await writeFile(join(restored, 'history', 'broken.json'), '{partial');
    expect(await new RunHistoryStore(join(restored, 'history')).loadRun('broken')).toBeNull();
  });
});
