import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsOverlay } from './SettingsOverlay';
import type { TaskRuntimeView } from '../run/useTaskRuntime';

const runtime = { connected: false, pending: false, refresh: vi.fn() } as unknown as TaskRuntimeView;

function renderOverlay(): string {
  return renderToStaticMarkup(createElement(SettingsOverlay, {
    runtime,
    approvalMode: 'full_access',
    setApprovalMode: vi.fn(),
    screenConsent: true,
    setScreenConsent: vi.fn(),
    isolatedEnvironment: true,
    setIsolatedEnvironment: vi.fn(),
    maxSteps: 25,
    setMaxSteps: vi.fn(),
    maxMinutes: 5,
    setMaxMinutes: vi.fn(),
    textSize: 'default',
    setTextSize: vi.fn(),
    themeMode: 'dark',
    setThemeMode: vi.fn(),
    desktopNotifications: true,
    setDesktopNotifications: vi.fn(),
    onClose: vi.fn(),
  }));
}

describe('SettingsOverlay', () => {
  it('opens on real agent controls without account or billing template pages', () => {
    const html = renderOverlay();
    expect(html).toContain('Approval mode');
    expect(html).not.toContain('Subscription');
    expect(html).not.toContain('Premium');
    expect(html).not.toContain('Devendra');
    expect(html).not.toContain('Account');
  });
});
