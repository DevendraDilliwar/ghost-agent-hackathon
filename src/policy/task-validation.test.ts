import { describe, expect, it } from 'vitest';
import { validateDesktopCommand, validateRunConfiguration } from './task-validation';

const frame = { width: 800, height: 600 };
const valid = { goal: 'Open the test page', maxSteps: 15, maxMinutes: 5, approvalMode: 'ask_approval', screenConsent: true, isolatedEnvironment: true };

describe('task boundary validation', () => {
  it('normalizes the goal and accepts explicit consent', () => {
    expect(validateRunConfiguration({ ...valid, goal: '  Open test page  ' }).goal).toBe('Open test page');
    expect(validateRunConfiguration({ ...valid, approvalMode: 'full_access' }).approvalMode).toBe('full_access');
  });
  it.each([
    { ...valid, goal: '' }, { ...valid, goal: 'x'.repeat(2001) }, { ...valid, maxSteps: 0 },
    { ...valid, maxSteps: 101 }, { ...valid, maxSteps: 2.5 }, { ...valid, maxMinutes: 0 },
    { ...valid, maxMinutes: 61 }, { ...valid, screenConsent: false },
    { ...valid, isolatedEnvironment: false }, { ...valid, approvalMode: 'invalid_mode' }, null,
  ])('rejects an invalid or unconsented run', value => {
    expect(() => validateRunConfiguration(value)).toThrow();
  });
  it('accepts extended mission budgets', () => {
    const configuration = validateRunConfiguration({ ...valid, maxSteps: 100, maxMinutes: 30 });
    expect(configuration).toMatchObject({ maxSteps: 100, maxMinutes: 30 });
  });
  it.each([
    { type: 'click', x: -1, y: 0 }, { type: 'click', x: 800, y: 0 },
    { type: 'click', x: 2.1, y: 0 }, { type: 'click', x: NaN, y: 0 },
    { type: 'click', x: 1, y: 0, button: 'execute' }, { type: 'drag', path: [] },
    { type: 'type', text: 'x'.repeat(4001) }, { type: 'type', text: '\0' },
    { type: 'keypress', keys: ['--exec'] }, { type: 'scroll', x: 1, y: 1, scroll_x: 0, scroll_y: 99999 },
  ])('rejects an unsupported or unsafe action shape', value => {
    expect(() => validateDesktopCommand(value, frame)).toThrow();
  });
  it('accepts boundary coordinates and strips unknown fields', () => {
    expect(validateDesktopCommand({ type: 'click', x: 799, y: 599, hiddenCommand: 'ignored' }, frame))
      .toEqual({ type: 'click', x: 799, y: 599, button: 'left' });
  });
  it('accepts an optional mission resume reference', () => {
    expect(validateRunConfiguration({ ...valid }).resume).toBeUndefined();
    expect(validateRunConfiguration({ ...valid, resume: { missionId: 'abc-123' } }).resume).toEqual({ missionId: 'abc-123' });
  });
  it.each([
    { ...valid, resume: { missionId: '../escape' } }, { ...valid, resume: { missionId: '' } },
    { ...valid, resume: { missionId: 'x'.repeat(81) } }, { ...valid, resume: 'm-1' }, { ...valid, resume: {} },
  ])('rejects an invalid mission resume reference', value => {
    expect(() => validateRunConfiguration(value)).toThrow('Invalid mission resume reference');
  });
});
