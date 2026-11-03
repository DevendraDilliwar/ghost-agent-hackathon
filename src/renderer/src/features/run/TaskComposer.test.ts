import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskComposer } from './TaskComposer';
import { attachmentError, BUDGET_PRESETS, matchBudgetPreset } from './task-presentation';

function render(maxSteps: number, maxMinutes: number, busy = false): string {
  return renderToStaticMarkup(createElement(TaskComposer, {
    connected: true, modelReady: true, ready: true, busy, initialGoal: '',
    approvalMode: 'full_access', screenConsent: true, isolatedEnvironment: true,
    maxSteps, maxMinutes, onOpenSetup: () => undefined, onLaunch: () => undefined, onBudgetChange: () => undefined,
  }));
}

describe('composer budget presets', () => {
  it('declares small, large, and max budgets in ascending size', () => {
    expect(BUDGET_PRESETS.map(preset => preset.id)).toEqual(['small', 'large', 'max']);
    const steps = BUDGET_PRESETS.map(preset => preset.maxSteps);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it('matches preset values and reports bespoke budgets as null', () => {
    expect(matchBudgetPreset(25, 10)).toBe('small');
    expect(matchBudgetPreset(150, 120)).toBe('large');
    expect(matchBudgetPreset(1000, 480)).toBe('max');
    expect(matchBudgetPreset(25, 5)).toBeNull();
  });

  it('marks the active preset pressed and shows all three options', () => {
    const html = render(150, 120);
    expect(html).toContain('aria-label="Task budget"');
    expect(html).toContain('Small budget: 25 steps · 10 min');
    expect(html).toContain('Large budget: 150 steps · 120 min');
    expect(html).toContain('Max budget: 1000 steps · 480 min');
    expect(html).toContain('aria-pressed="true"');
  });

  it('marks no preset pressed for bespoke slider values', () => {
    const html = render(25, 5);
    expect(html).not.toContain('aria-pressed="true"');
  });

  it('disables preset buttons while a run is busy', () => {
    const html = render(25, 10, true);
    expect(html).toContain('composer-budget-option is-active" disabled');
  });

  it('offers a source-image picker and no chips before anything is attached', () => {
    const html = render(25, 8);
    expect(html).toContain('aria-label="Attach a source image"');
    expect(html).toContain('accept="image/png,image/jpeg"');
    expect(html).not.toContain('composer-attachment-chip');
  });
});

describe('attachment pre-check', () => {
  it('accepts a small PNG or JPEG inside the count limit', () => {
    expect(attachmentError('bill.jpg', 'image/jpeg', 1024, 0)).toBeNull();
    expect(attachmentError('sheet.png', 'image/png', 8_000_000, 2)).toBeNull();
  });

  it('rejects over-limit, wrong-type, bad-name, and oversize files', () => {
    expect(attachmentError('fourth.png', 'image/png', 1024, 3)).toBe('Attach at most 3 images.');
    expect(attachmentError('bill.gif', 'image/gif', 1024, 0)).toBe('Only PNG and JPEG images can be attached.');
    expect(attachmentError('', 'image/png', 1024, 0)).toBe('Invalid attachment name.');
    expect(attachmentError('huge.png', 'image/png', 8_000_001, 0)).toBe('Each image must be under 8MB.');
  });
});
