import { describe, expect, it } from 'vitest';
import { MissionMemory } from './mission-memory';
import type { MissionPlan } from '../../shared/contracts/mission';

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

describe('step progress', () => {
  it('starts fresh and moves the pointer only forward within range', () => {
    const { memory } = setup();
    const phase = memory.addPhase('gcp', 'Deploy backend', { steps: ['Create the service', 'Deploy', 'Verify URL'] });
    expect([phase.completedSteps, phase.activeStep]).toEqual([[], null]);
    memory.noteActiveStep(phase.phaseId, 2);
    expect(memory.getPlan().phases.at(-1)).toMatchObject({ completedSteps: [], activeStep: 1 });
    memory.noteActiveStep(phase.phaseId, 1);
    memory.noteActiveStep(phase.phaseId, 99);
    memory.noteActiveStep(phase.phaseId, 0);
    expect(memory.getPlan().phases.at(-1)?.activeStep).toBe(1);
    memory.noteActiveStep(phase.phaseId, 3);
    expect(memory.getPlan().phases.at(-1)?.activeStep).toBe(2);
  });

  it('settles the audit and points at the first incomplete step', () => {
    const { memory } = setup();
    const phase = memory.addPhase('gcp', 'Deploy backend', { steps: ['Create the service', 'Deploy', 'Verify URL'] });
    memory.noteActiveStep(phase.phaseId, 3);
    memory.setCompletedSteps(phase.phaseId, [0, 2, 2, 99, -1]);
    expect(memory.getPlan().phases.at(-1)).toMatchObject({ completedSteps: [0, 2], activeStep: 1 });
    memory.setCompletedSteps(phase.phaseId, [0, 1, 2]);
    expect(memory.getPlan().phases.at(-1)).toMatchObject({ completedSteps: [0, 1, 2], activeStep: null });
  });

  it('marks every step complete when the phase completes', () => {
    const { memory } = setup();
    const phase = memory.addPhase('gcp', 'Deploy backend', { steps: ['Create the service', 'Deploy'] });
    memory.startPhase(phase.phaseId);
    memory.completePhase(phase.phaseId);
    expect(memory.getPlan().phases.at(-1)).toMatchObject({ status: 'done', completedSteps: [0, 1], activeStep: null });
  });

  it('rejects out-of-range step progress on restore', () => {
    const { memory } = setup();
    memory.addPhase('gcp', 'Deploy backend', { steps: ['Create the service'] });
    const plan = memory.getPlan();
    const bad = (completedSteps: unknown, activeStep: unknown) => ({
      ...plan, phases: plan.phases.map(phase => ({ ...phase, completedSteps, activeStep })),
    }) as unknown as MissionPlan;
    expect(() => MissionMemory.restore(bad([1], null))).toThrow('Invalid mission step progress');
    expect(() => MissionMemory.restore(bad([], 5))).toThrow('Invalid mission step progress');
    expect(() => MissionMemory.restore(bad('done', null))).toThrow('Invalid mission step progress');
  });
});
