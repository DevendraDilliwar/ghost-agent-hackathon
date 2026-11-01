import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentChatView } from './AgentChatView';
import type { TaskRuntimeView } from '../run/useTaskRuntime';

const runtime = { snapshot: null, connected: false, refresh: vi.fn() } as unknown as TaskRuntimeView;

describe('AgentChatView', () => {
  it('renders the real navigation without dead clone entries', () => {
    const html = renderToStaticMarkup(createElement(AgentChatView, { runtime }));
    expect(html).toContain('New chat');
    expect(html).toContain('Library');
    expect(html).not.toContain('Scheduled');
    expect(html).not.toContain('Students');
    expect(html).not.toContain('Images');
    expect(html).not.toContain('Upgrade');
    expect(html).not.toContain('Notebooks');
    expect(html).not.toContain('ok genrate');
    expect(html).not.toContain('Gemini');
    expect(html).toContain('Tasks');
  });

  it('uses the agent mark instead of the cloned logo', () => {
    const html = renderToStaticMarkup(createElement(AgentChatView, { runtime }));
    expect(html).toContain('lucide-bot');
    expect(html).not.toContain('gemini-mark');
  });

  it('marks the dashboard with the persisted text size', () => {
    const html = renderToStaticMarkup(createElement(AgentChatView, { runtime }));
    expect(html).toContain('data-text-size="default"');
    expect(html).toContain('data-theme="dark"');
  });

  it('keeps the composer free of the fake mode switch', () => {
    const html = renderToStaticMarkup(createElement(AgentChatView, { runtime }));
    expect(html).not.toContain('Configure agent mode');
    expect(html).not.toContain('can make mistakes');
  });
});
