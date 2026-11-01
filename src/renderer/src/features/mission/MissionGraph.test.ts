import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionGraph } from './MissionGraph';
import type { MissionPlan } from '../../../../shared/contracts/mission';

function plan(): MissionPlan {
  return {
    missionId: 'm-1', goal: 'Deploy my project', createdAt: 1,
    phases: [
      { phaseId: 'phase-1', domain: 'github', goal: 'Push code', status: 'done',
        notes: ['pushed'], steps: ['Commit', 'Push'], success: 'Push succeeded', startedAt: 1, finishedAt: 2 },
      { phaseId: 'phase-2', domain: 'gcp', goal: 'Deploy backend', status: 'active',
        notes: ['project: acme-prod'], steps: ['Create the service', 'Deploy'], success: 'Service URL serves traffic',
        startedAt: 3, finishedAt: null },
      { phaseId: 'phase-3', domain: 'vercel', goal: 'Deploy frontend', status: 'pending',
        notes: [], steps: ['Import repo'], success: 'URL is live', startedAt: null, finishedAt: null },
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
});
