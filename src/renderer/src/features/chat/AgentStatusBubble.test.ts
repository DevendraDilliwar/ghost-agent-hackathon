import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentStatusBubble } from './AgentStatusBubble';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { AgentStatus, TaskSnapshot } from '../../../../shared/contracts/task';

function snapshot(status: AgentStatus): TaskSnapshot {
  return {
    runId: 'run-1', revision: 3, status, goal: 'Test goal', maxSteps: 25, maxMinutes: 5,
    actions: [{ id: 'a-1', type: 'click', status: 'executed', timestamp: 't', description: 'Click the target' }],
    messages: [], screenshot: null, pendingActionId: null, message: 'Working on it.',
    awaitingCompletion: false, handoff: null, inputTokens: 10, outputTokens: 5, intent: null, mission: null,
  };
}

function runtimeFor(status: AgentStatus): TaskRuntimeView {
  return { snapshot: snapshot(status), pending: false } as unknown as TaskRuntimeView;
}

describe('AgentStatusBubble', () => {
  it('renders nothing when no task is active', () => {
    expect(renderToStaticMarkup(createElement(AgentStatusBubble, { runtime: runtimeFor('idle') }))).toBe('');
    expect(renderToStaticMarkup(createElement(AgentStatusBubble, { runtime: runtimeFor('completed') }))).toBe('');
    expect(renderToStaticMarkup(createElement(AgentStatusBubble, { runtime: runtimeFor('failed') }))).toBe('');
  });

  it('shows the live status, message and last step while active', () => {
    const html = renderToStaticMarkup(createElement(AgentStatusBubble, { runtime: runtimeFor('acting') }));
    expect(html).toContain('Working on your task');
    expect(html).toContain('Working on it.');
    expect(html).toContain('Last step: Click the target');
  });
});
