import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApprovalCard } from './ApprovalCard';
import type { TaskRuntimeView } from './useTaskRuntime';
import type { AgentAction, TaskSnapshot } from '../../../../shared/contracts/task';

function snapshot(actions: AgentAction[]): TaskSnapshot {
  return {
    runId: 'run-1', revision: 3, status: 'awaiting_approval', goal: 'Test goal', maxSteps: 25, maxMinutes: 5,
    actions, messages: [], screenshot: null, pendingActionId: 'a-1', message: 'Review the next action.',
    awaitingCompletion: false, handoff: null, inputTokens: 10, outputTokens: 5, intent: null, mission: null,
  };
}

function runtimeFor(actions: AgentAction[]): TaskRuntimeView {
  return { snapshot: snapshot(actions), pending: false, review: vi.fn() } as unknown as TaskRuntimeView;
}

describe('ApprovalCard', () => {
  it('renders nothing without a pending action', () => {
    const html = renderToStaticMarkup(createElement(ApprovalCard, { runtime: runtimeFor([]) }));
    expect(html).toBe('');
  });

  it('renders the pending action with approve and reject buttons', () => {
    const html = renderToStaticMarkup(createElement(ApprovalCard, { runtime: runtimeFor([
      { id: 'a-1', type: 'click', status: 'awaiting_approval', timestamp: 't', description: 'Click the deploy button',
        coordinates: { x: 10, y: 20 }, target: 'Deploy' },
    ]) }));
    expect(html).toContain('Review this action');
    expect(html).toContain('Click the deploy button');
    expect(html).toContain('(10, 20)');
    expect(html).toContain('Approve');
    expect(html).toContain('Reject');
  });
});
