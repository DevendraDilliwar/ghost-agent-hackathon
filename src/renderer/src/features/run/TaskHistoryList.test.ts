import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskHistoryList } from './TaskHistoryList';
import type { RunSummary } from '../../../../shared/contracts/history';

const runs: RunSummary[] = [
  { runId: 'run-3', goal: 'Live task', status: 'acting', createdAt: 30, updatedAt: 30, missionId: null, resumable: false },
  { runId: 'run-2', goal: 'Old done task', status: 'completed', createdAt: 20, updatedAt: 20, missionId: null, resumable: false },
  { runId: 'run-1', goal: 'Failed task', status: 'failed', createdAt: 10, updatedAt: 10, missionId: null, resumable: false },
];

describe('TaskHistoryList', () => {
  it('pins the active task above past runs with status dots', () => {
    const html = renderToStaticMarkup(createElement(TaskHistoryList, { runs, activeRunId: 'run-3', selectedRunId: null, search: '', onSelect: vi.fn() }));
    expect(html).toContain('Tasks');
    expect(html.indexOf('Live task')).toBeLessThan(html.indexOf('Old done task'));
    expect(html).toContain('bg-amber-500');
    expect(html).toContain('bg-emerald-500');
    expect(html).toContain('bg-rose-500');
    expect(html).toContain('history-item history-task selected');
  });

  it('filters by search and shows an empty state', () => {
    const html = renderToStaticMarkup(createElement(TaskHistoryList, { runs, activeRunId: null, selectedRunId: null, search: 'failed', onSelect: vi.fn() }));
    expect(html).toContain('Failed task');
    expect(html).not.toContain('Old done task');
    const empty = renderToStaticMarkup(createElement(TaskHistoryList, { runs: [], activeRunId: null, selectedRunId: null, search: '', onSelect: vi.fn() }));
    expect(empty).toContain('No tasks yet');
  });
});
