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

function render(activeRunId: string | null, selectedRunId: string | null, search: string, list: RunSummary[] = runs): string {
  return renderToStaticMarkup(createElement(TaskHistoryList,
    { runs: list, activeRunId, selectedRunId, search, onSelect: vi.fn(), onDelete: vi.fn() }));
}

describe('TaskHistoryList', () => {
  it('pins the active task above past runs with status dots', () => {
    const html = render('run-3', 'run-1', '');
    expect(html.indexOf('Live task')).toBeLessThan(html.indexOf('Old done task'));
    expect(html).toContain('selected');
    expect(html).toContain('rounded-full');
  });

  it('marks runs that carried attachments', () => {
    const attached: RunSummary[] = [{ ...runs[1]!, attachmentNames: ['bill.jpg', 'page2.png'] }];
    const html = renderToStaticMarkup(createElement(TaskHistoryList,
      { runs: attached, activeRunId: null, selectedRunId: null, search: '', onSelect: vi.fn(), onDelete: vi.fn() }));
    expect(html).toContain('history-attachment');
    expect(html).toContain('bill.jpg, page2.png');
    const plain = render('run-3', null, '');
    expect(plain).not.toContain('history-attachment');
  });

  it('filters by search and shows an empty state', () => {
    const html = render(null, null, 'failed');
    expect(html).toContain('Failed task');
    expect(html).not.toContain('Old done task');
    const empty = render(null, null, '', []);
    expect(empty).toContain('No tasks yet');
  });

  it('offers a closed options menu on past runs only', () => {
    const html = render('run-3', null, '');
    expect(html).toContain('Options for Old done task');
    expect(html).toContain('Options for Failed task');
    expect(html).not.toContain('Options for Live task');
    expect(html).not.toContain('Confirm delete');
  });
});
