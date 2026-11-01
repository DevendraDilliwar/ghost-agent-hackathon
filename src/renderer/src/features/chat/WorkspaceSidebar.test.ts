import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import type { TaskRuntimeView } from '../run/useTaskRuntime';

const runtime = { snapshot: null } as unknown as TaskRuntimeView;

describe('WorkspaceSidebar', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceSidebar, { runtime, open: false, onClose: vi.fn() }));
    expect(html).toBe('');
  });

  it('renders the workspace drawer with its close control when open', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceSidebar, { runtime, open: true, onClose: vi.fn() }));
    expect(html).toContain('Live workspace');
    expect(html).toContain('Start a task from the chat');
  });
});
