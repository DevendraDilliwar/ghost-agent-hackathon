import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore } from './checkpoint-store';
import type { PhaseCheckpoint } from '../shared/contracts/mission';

function checkpoint(overrides?: Partial<PhaseCheckpoint>): PhaseCheckpoint {
  return {
    missionId: 'm-1', phaseId: 'phase-1', order: 0, domain: 'gcp', goal: 'Deploy backend',
    status: 'active', notes: ['project: acme-prod'], steps: ['Create the service'], success: 'Service URL serves traffic',
    intent: { summary: 'Deploy', params: {}, missing: [] },
    clarifications: [], executedDescs: ['executed: Click the deploy button'], lastVerification: 'PRISM verified',
    inputTokens: 100, outputTokens: 20, noProgressStreak: 0, savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('CheckpointStore', () => {
  it('round-trips mission meta and phase checkpoints in plan order', async () => {
    const store = new CheckpointStore(await mkdtemp(join(tmpdir(), 'nomcp-missions-')));
    await store.saveMission({ missionId: 'm-1', goal: 'Ship it', createdAt: 42 });
    await store.save(checkpoint({ phaseId: 'phase-2', order: 1, domain: 'vercel', goal: 'Deploy frontend', status: 'pending', notes: [] }));
    await store.save(checkpoint({}));
    expect(await store.loadMission('m-1')).toEqual({ missionId: 'm-1', goal: 'Ship it', createdAt: 42 });
    expect(await store.load('m-1', 'phase-1')).toEqual(checkpoint({}));
    expect((await store.list('m-1')).map(item => item.phaseId)).toEqual(['phase-1', 'phase-2']);
  });

  it('returns null for missing, corrupt or mismatched checkpoints', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-missions-'));
    const store = new CheckpointStore(directory);
    expect(await store.load('m-1', 'phase-1')).toBeNull();
    expect(await store.loadMission('m-1')).toBeNull();
    await mkdir(join(directory, 'm-1', 'checkpoints'), { recursive: true });
    await writeFile(join(directory, 'm-1', 'checkpoints', 'phase-1.json'), 'not-json{{{');
    expect(await store.load('m-1', 'phase-1')).toBeNull();
    expect(await store.list('m-1')).toEqual([]);
    await store.save(checkpoint({}));
    expect(await store.load('m-1', 'phase-2')).toBeNull();
  });

  it('rejects unsafe ids without writing outside the base directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-missions-'));
    const store = new CheckpointStore(directory);
    await store.save(checkpoint({ missionId: '../escape', phaseId: 'phase-1' }));
    await store.saveMission({ missionId: '../escape', goal: 'evil', createdAt: 1 });
    expect(await store.load('../escape', 'phase-1')).toBeNull();
    expect(await store.loadMission('../escape')).toBeNull();
  });

  it('never throws on unwritable locations', async () => {
    const blocker = join(await mkdtemp(join(tmpdir(), 'nomcp-missions-')), 'blocker');
    await writeFile(blocker, 'x');
    const store = new CheckpointStore(join(blocker, 'nested'));
    await expect(store.save(checkpoint({}))).resolves.toBeUndefined();
    await expect(store.load('m-1', 'phase-1')).resolves.toBeNull();
    await expect(store.list('m-1')).resolves.toEqual([]);
  });

  it('lists mission summaries newest-first and skips invalid entries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-missions-'));
    const store = new CheckpointStore(directory);
    await store.saveMission({ missionId: 'm-old', goal: 'Old task', createdAt: 10 });
    await store.save(checkpoint({ missionId: 'm-old', savedAt: 20 }));
    await store.saveMission({ missionId: 'm-new', goal: 'New task', createdAt: 30 });
    await store.save(checkpoint({ missionId: 'm-new', phaseId: 'phase-1', status: 'failed', savedAt: 40 }));
    await store.save(checkpoint({ missionId: 'm-new', phaseId: 'phase-2', order: 1, status: 'pending', notes: [], savedAt: 41 }));
    await mkdir(join(directory, 'm-broken'), { recursive: true });
    const missions = await store.listMissions();
    expect(missions.map(mission => mission.missionId)).toEqual(['m-new', 'm-old']);
    expect(missions[0]).toMatchObject({ goal: 'New task', updatedAt: 41 });
    expect(missions[0]!.phases.map(phase => phase.status)).toEqual(['failed', 'pending']);
  });

  it('writes checkpoints as plain JSON readable without the store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nomcp-missions-'));
    const store = new CheckpointStore(directory);
    await store.save(checkpoint({ status: 'failed' }));
    const raw = JSON.parse(await readFile(join(directory, 'm-1', 'checkpoints', 'phase-1.json'), 'utf8'));
    expect(raw.status).toBe('failed');
    expect(raw.executedDescs).toEqual(['executed: Click the deploy button']);
  });
});
