import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionSetup } from './ConnectionSetup';
import type { TaskRuntimeView } from '../run/useTaskRuntime';

function runtime(overrides: Record<string, unknown> = {}): TaskRuntimeView {
  return {
    connection: null,
    readiness: null,
    pending: false,
    connected: false,
    setupError: null,
    refresh: vi.fn(),
    connectModel: vi.fn(),
    ...overrides,
  } as unknown as TaskRuntimeView;
}

describe('ConnectionSetup', () => {
  it('speaks the settings-row language instead of its own card design', () => {
    const html = renderToStaticMarkup(createElement(ConnectionSetup, { runtime: runtime() }));
    expect(html).toContain('settings-row');
    expect(html).toContain('Meta API Key');
    expect(html).toContain('Save &amp; Connect');
    expect(html).not.toContain('System Readiness Checks');
    expect(html).not.toContain('Connect Meta API');
  });

  it('keeps the configured-key flow with test, change, and remove actions', () => {
    const html = renderToStaticMarkup(createElement(ConnectionSetup, {
      runtime: runtime({
        connected: true,
        connection: { configured: true, verified: false, model: 'meta-scout', source: 'stored', hasStored: true },
      }),
    }));
    expect(html).toContain('Active Model');
    expect(html).toContain('meta-scout');
    expect(html).toContain('Test Configured Key');
    expect(html).toContain('Change Key');
    expect(html).toContain('Remove Saved Key');
  });

  it('keeps readiness signals visible as status rows', () => {
    const html = renderToStaticMarkup(createElement(ConnectionSetup, {
      runtime: runtime({
        readiness: { ready: false, desktopSupported: true, emergencyStopReady: false, issues: ['Desktop capture blocked'] },
      }),
    }));
    expect(html).toContain('Desktop Capture &amp; Input');
    expect(html).toContain('Emergency Stop Hotkey');
    expect(html).toContain('Desktop capture blocked');
  });
});
