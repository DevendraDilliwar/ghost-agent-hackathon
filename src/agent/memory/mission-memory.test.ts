import { describe, expect, it } from 'vitest';
import { MissionMemory } from './mission-memory';

function setup() {
  const memory = new MissionMemory('m-1', 'Deploy repo: backend to GCP, frontend to Vercel');
  const github = memory.addPhase('github', 'Push code to GitHub');
  const gcp = memory.addPhase('gcp', 'Deploy backend to Cloud Run');
  const vercel = memory.addPhase('vercel', 'Deploy frontend to Vercel');
  return { memory, github, gcp, vercel };
}

describe('mission phase lifecycle', () => {
  it('runs one phase at a time from pending to done', () => {
    const { memory, github, gcp } = setup();
    memory.startPhase(github.phaseId);
    expect(memory.currentPhase()?.phaseId).toBe(github.phaseId);
    expect(() => memory.startPhase(gcp.phaseId)).toThrow('Finish the active phase');
    memory.completePhase(github.phaseId, 'pushed to main');
    expect(memory.currentPhase()).toBeNull();
    memory.startPhase(gcp.phaseId);
    expect(memory.getPlan().phases.find(phase => phase.phaseId === github.phaseId)?.status).toBe('done');
  });

  it('records failures without touching other phases', () => {
    const { memory, gcp, vercel } = setup();
    memory.startPhase(gcp.phaseId);
    memory.failPhase(gcp.phaseId, 'billing not enabled');
    const plan = memory.getPlan();
    expect(plan.phases.find(phase => phase.phaseId === gcp.phaseId)?.status).toBe('failed');
    expect(plan.phases.find(phase => phase.phaseId === vercel.phaseId)?.status).toBe('pending');
  });

  it('rejects illegal transitions, unknown phases and malformed domains', () => {
    const { memory, github } = setup();
    expect(() => memory.completePhase(github.phaseId)).toThrow('Only the active phase can complete');
    expect(() => memory.startPhase('phase-99')).toThrow('Unknown mission phase');
    expect(() => memory.addPhase('', 'Notify')).toThrow('Invalid mission domain');
    expect(() => memory.addPhase('has spaces!', 'Notify')).toThrow('Invalid mission domain');
    expect(() => memory.addPhase('x'.repeat(33), 'Notify')).toThrow('Invalid mission domain');
  });

  it('accepts any agent-chosen domain, not a fixed list', () => {
    const { memory } = setup();
    for (const domain of ['aws', 'sap', 'tally-prime_2', 'slack']) {
      expect(memory.addPhase(domain, 'Do ' + domain + ' work').domain).toBe(domain);
    }
  });

  it('stores step checklists and success conditions per phase', () => {
    const { memory } = setup();
    const phase = memory.addPhase('vercel', 'Deploy frontend', { steps: ['Import repo', 'Deploy'], success: 'URL is live' });
    expect(memory.getPhaseContext(phase.phaseId)).toMatchObject({ steps: ['Import repo', 'Deploy'], success: 'URL is live' });
    const restored = MissionMemory.restore(memory.getPlan());
    expect(restored.getPhaseContext(phase.phaseId)).toMatchObject({ steps: ['Import repo', 'Deploy'], success: 'URL is live' });
    expect(() => memory.addPhase('gcp', 'Deploy', { steps: ['x'.repeat(201)] })).toThrow('Invalid mission phase step');
    expect(() => memory.addPhase('gcp', 'Deploy', { success: 'x'.repeat(501) })).toThrow('Invalid mission success condition');
  });
});

describe('domain-separated context', () => {
  it('never leaks one domain notes into another domain context', () => {
    const { memory, github, gcp } = setup();
    memory.startPhase(github.phaseId);
    memory.addNote(github.phaseId, 'repo: acme/shop, branch: main');
    memory.completePhase(github.phaseId);
    memory.startPhase(gcp.phaseId);
    memory.addNote(gcp.phaseId, 'project: acme-prod, region: asia-south1');
    const context = memory.getPhaseContext(gcp.phaseId);
    expect(context.notes).toEqual(['project: acme-prod, region: asia-south1']);
    expect(JSON.stringify(context)).not.toContain('acme/shop');
  });

  it('returns copies so callers cannot mutate stored memory', () => {
    const { memory, github } = setup();
    const context = memory.getPhaseContext(github.phaseId);
    (context.notes as string[]).push('sneaky');
    expect(memory.getPhaseContext(github.phaseId).notes).toEqual([]);
  });

  it('bounds goals and notes', () => {
    const { memory, github } = setup();
    expect(() => memory.addPhase('gcp', '')).toThrow('Invalid mission phase goal');
    expect(() => memory.addNote(github.phaseId, 'x'.repeat(501))).toThrow('Invalid mission note');
    expect(() => new MissionMemory('m-2', '')).toThrow('Invalid mission goal');
  });
});

describe('restore and reactivate (resume path)', () => {
  it('restores a plan with statuses intact and keeps phase numbering unique', () => {
    const { memory, github, gcp } = setup();
    memory.startPhase(github.phaseId);
    memory.completePhase(github.phaseId, 'pushed');
    memory.startPhase(gcp.phaseId);
    const restored = MissionMemory.restore(memory.getPlan());
    expect(restored.currentPhase()?.phaseId).toBe(gcp.phaseId);
    expect(restored.getPlan().phases.find(phase => phase.phaseId === github.phaseId)?.status).toBe('done');
    const added = restored.addPhase('vercel', 'Another frontend pass');
    expect(added.phaseId).toBe('phase-4');
  });

  it('reactivates a failed phase while keeping its failure history', () => {
    const { memory, gcp } = setup();
    memory.startPhase(gcp.phaseId);
    memory.failPhase(gcp.phaseId, 'billing not enabled');
    memory.reactivatePhase(gcp.phaseId);
    const current = memory.currentPhase();
    expect(current?.phaseId).toBe(gcp.phaseId);
    expect(current?.finishedAt).toBeNull();
    expect(current?.notes).toEqual(['FAILED: billing not enabled']);
    expect(() => memory.reactivatePhase(gcp.phaseId)).toThrow('Only a failed phase can restart');
  });

  it('rejects malformed plans on restore', () => {
    const { memory } = setup();
    const plan = memory.getPlan();
    expect(() => MissionMemory.restore({ ...plan, phases: [] }).addPhase('bad domain!', 'y')).toThrow('Invalid mission domain');
    expect(() => MissionMemory.restore({ ...plan, goal: '' })).toThrow('Invalid mission goal');
  });
});
