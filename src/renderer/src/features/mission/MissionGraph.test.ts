import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionGraph, buildRetryNote, stepState } from './MissionGraph';
import type { MissionPlan, PhaseRecord } from '../../../../shared/contracts/mission';

function plan(): MissionPlan {
  return {
    missionId: 'm-1', goal: 'Deploy my project', createdAt: 1,
    phases: [
      { phaseId: 'phase-1', domain: 'github', goal: 'Push code', status: 'done',
        notes: ['pushed'], steps: ['Commit', 'Push'], success: 'Push succeeded', startedAt: 1, finishedAt: 2,
        completedSteps: [0, 1], activeStep: null },
      { phaseId: 'phase-2', domain: 'gcp', goal: 'Deploy backend', status: 'active',
        notes: ['project: acme-prod'], steps: ['Create the service', 'Deploy'], success: 'Service URL serves traffic',
        startedAt: 3, finishedAt: null, completedSteps: [0], activeStep: 1 },
      { phaseId: 'phase-3', domain: 'vercel', goal: 'Deploy frontend', status: 'pending',
        notes: [], steps: ['Import repo'], success: 'URL is live', startedAt: null, finishedAt: null,
        completedSteps: [], activeStep: null },
    ],
  };
}

describe('MissionGraph', () => {
  it('renders nothing without a mission', () => {
    expect(renderToStaticMarkup(createElement(MissionGraph, { mission: null }))).toBe('');
  });

  it('renders the goal root with phase progress', () => {
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: plan() }));
    expect(html).toContain('Deploy my project');
    expect(html).toContain('1/3');
    expect(html).toContain('github');
    expect(html).toContain('Push code');
    expect(html).toContain('Deploy backend');
    expect(html).toContain('Deploy frontend');
  });

  it('expands steps only on the active and failed branches', () => {
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: plan() }));
    expect(html).toContain('Create the service');
    expect(html).toContain('Done when: Service URL serves traffic');
    expect(html).not.toContain('Commit');
    expect(html).not.toContain('Import repo');
  });

  it('shows the failure note on failed branches', () => {
    const failed = plan();
    failed.phases[1] = { ...failed.phases[1]!, status: 'failed', notes: ['FAILED: billing not enabled'] };
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: failed }));
    expect(html).toContain('FAILED: billing not enabled');
    expect(html).toContain('Create the service');
  });

  it('colors active steps green, yellow and gray from progress', () => {
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: plan() }));
    expect(html).toContain('2/2 steps complete');
    expect(html).toContain('aria-label="step done"');
    expect(html).toContain('aria-label="step in progress"');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('text-amber-700');
  });

  it('marks the frozen step red on failed branches', () => {
    const failed = plan();
    failed.phases[1] = { ...failed.phases[1]!, status: 'failed', notes: ['FAILED: billing not enabled'] };
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: failed }));
    expect(html).toContain('aria-label="step failed"');
    expect(html).toContain('aria-label="step done"');
  });

  it('offers retry from the frozen step on failed branches with a handler', () => {
    const failed = plan();
    failed.phases[1] = { ...failed.phases[1]!, status: 'failed', notes: ['FAILED: billing not enabled'] };
    const html = renderToStaticMarkup(createElement(MissionGraph, { mission: failed, onRetryPhase: () => undefined }));
    expect(html).toContain('Retry from step 2');
    expect(renderToStaticMarkup(createElement(MissionGraph, { mission: failed }))).not.toContain('Retry from step');
    expect(renderToStaticMarkup(createElement(MissionGraph, { mission: plan(), onRetryPhase: () => undefined }))).not.toContain('Retry from step');
  });
});

describe('buildRetryNote', () => {
  it('names the frozen step and asks for a different approach', () => {
    const failed = plan().phases[1]!;
    expect(buildRetryNote({ ...failed, status: 'failed' }))
      .toBe('Retry requested from step 2: Deploy. The previous attempt failed — try a different approach for this step.');
  });

  it('falls back to step 1 and stays within the note limit', () => {
    const failed = plan().phases[1]!;
    expect(buildRetryNote({ ...failed, status: 'failed', activeStep: null, steps: [] })).toContain('Retry requested from step 1.');
    const long = buildRetryNote({ ...failed, status: 'failed', activeStep: 0, steps: ['x'.repeat(500)] });
    expect(long).toContain('x'.repeat(200));
    expect(long).not.toContain('x'.repeat(201));
    expect(long.length).toBeLessThanOrEqual(500);
  });
});

describe('stepState', () => {
  const base: PhaseRecord = {
    phaseId: 'phase-1', domain: 'gcp', goal: 'Deploy backend', status: 'active',
    notes: [], steps: ['Create the service', 'Deploy', 'Verify URL'], success: 'Live',
    startedAt: 1, finishedAt: null, completedSteps: [], activeStep: null,
  };

  it('starts on the first step before any tag arrives', () => {
    expect([stepState(base, 0), stepState(base, 1), stepState(base, 2)]).toEqual(['active', 'pending', 'pending']);
  });

  it('greens the pointer trail and verified steps', () => {
    const phase = { ...base, completedSteps: [0], activeStep: 2 };
    expect([stepState(phase, 0), stepState(phase, 1), stepState(phase, 2)]).toEqual(['done', 'done', 'active']);
  });

  it('keeps pending phases gray and done phases green', () => {
    expect(stepState({ ...base, status: 'pending' }, 0)).toBe('pending');
    expect(stepState({ ...base, status: 'done' }, 2)).toBe('done');
  });

  it('freezes failed phases with red on the stuck step', () => {
    const phase = { ...base, status: 'failed' as const, activeStep: 1 };
    expect([stepState(phase, 0), stepState(phase, 1), stepState(phase, 2)]).toEqual(['done', 'failed', 'pending']);
  });
});
