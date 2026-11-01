import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatThread } from './ChatThread';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { TaskSnapshot } from '../../../../shared/contracts/task';

function snapshot(): TaskSnapshot {
  return {
    runId: 'run-1', revision: 3, status: 'acting', goal: 'Test goal', maxSteps: 25, maxMinutes: 5,
    actions: [{ id: 'a-1', type: 'click', status: 'executed', timestamp: 't', description: 'Click the target' }],
    messages: [{ id: 'm-1', sender: 'user', content: 'Test goal', timestamp: 't' }],
    screenshot: null, pendingActionId: null, message: 'Working on it.',
    awaitingCompletion: false, handoff: null, inputTokens: 10, outputTokens: 5, intent: null, mission: null,
  };
}

describe('ChatThread', () => {
  it('greets with empty state and preview notice when idle and disconnected', () => {
    const runtime = { snapshot: null, connected: false, refresh: vi.fn() } as unknown as TaskRuntimeView;
    const html = renderToStaticMarkup(createElement(ChatThread, { runtime, onOpenSetup: vi.fn() }));
    expect(html).toContain('What should I do on your desktop?');
    expect(html).toContain('Browser UI preview mode');
  });

  it('shows messages, live status and activity while a task runs', () => {
    const runtime = { snapshot: snapshot(), connected: true, refresh: vi.fn() } as unknown as TaskRuntimeView;
    const html = renderToStaticMarkup(createElement(ChatThread, { runtime, onOpenSetup: vi.fn() }));
    expect(html).toContain('Test goal');
    expect(html).toContain('Working on it.');
    expect(html).toContain('Live activity');
    expect(html).toContain('Click the target');
  });
});
