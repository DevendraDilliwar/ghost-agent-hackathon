import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskComposer } from './TaskComposer';
import { BUDGET_PRESETS, matchBudgetPreset } from './task-presentation';

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
    expect(matchBudgetPreset(10, 3)).toBe('small');
    expect(matchBudgetPreset(25, 8)).toBe('large');
    expect(matchBudgetPreset(60, 20)).toBe('max');
    expect(matchBudgetPreset(25, 5)).toBeNull();
  });

  it('marks the active preset pressed and shows all three options', () => {
    const html = render(25, 8);
    expect(html).toContain('aria-label="Task budget"');
    expect(html).toContain('Small budget: 10 steps · 3 min');
    expect(html).toContain('Large budget: 25 steps · 8 min');
    expect(html).toContain('Max budget: 60 steps · 20 min');
    expect(html).toContain('aria-pressed="true"');
  });

  it('marks no preset pressed for bespoke slider values', () => {
    const html = render(25, 5);
    expect(html).not.toContain('aria-pressed="true"');
  });

  it('disables preset buttons while a run is busy', () => {
    const html = render(10, 3, true);
    expect(html).toContain('composer-budget-option is-active" disabled');
  });
});
