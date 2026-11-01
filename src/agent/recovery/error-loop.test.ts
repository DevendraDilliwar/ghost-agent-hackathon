import { describe, expect, it } from 'vitest';
import { ErrorLoop } from './error-loop';
import type { FailureContext } from './error-loop';

const loop = new ErrorLoop();

function context(overrides?: Partial<FailureContext>): FailureContext {
  return {
    action: { type: 'click', x: 10, y: 10, button: 'left' },
    verificationSummary: 'PRISM warning: No visual change detected on screen after action.',
    typeDetail: null,
    streak: 0,
    phase: { phaseId: 'phase-2', domain: 'gcp', goal: 'Deploy backend', status: 'active', notes: [], steps: [], success: '' },
    recentAttempts: ['executed: Click the deploy button'],
    priorGuidance: null,
    ...overrides,
  };
}

describe('ErrorLoop recovery decisions', () => {
  it('retries a failed type with focus-recovery guidance', () => {
    const decision = loop.decide(context({ action: { type: 'type', text: 'secret' }, typeDetail: 'No text field visible.' }));
    expect(decision).toEqual({ kind: 'retry',
      guidance: 'The last type failed (No text field visible.). Do not repeat it unchanged - back out (Escape), re-check focus, then type again.' });
  });

  it('retries stalled clicks with the generic back-out guidance', () => {
    const decision = loop.decide(context({}));
    expect(decision).toEqual({ kind: 'retry',
      guidance: 'The last action caused no visible change. Do not repeat it unchanged - back out or try a different target.' });
  });

  it('retries stalled shortcuts and scrolls with focus-first guidance', () => {
    const keys = loop.decide(context({ action: { type: 'keypress', keys: ['Control', 'a'] } }));
    expect(keys.kind).toBe('retry');
    if (keys.kind === 'retry') expect(keys.guidance).toContain('Click the target field first');
    const scroll = loop.decide(context({ action: { type: 'scroll', x: 1, y: 1, scroll_x: 0, scroll_y: -120 } }));
    expect(scroll.kind).toBe('retry');
    if (scroll.kind === 'retry') expect(scroll.guidance).toContain('Click inside the area to scroll first');
  });

  it('escalates on the second consecutive failure with the full story', () => {
    const decision = loop.decide(context({ streak: 1,
      priorGuidance: 'The last action caused no visible change. Do not repeat it unchanged.',
      recentAttempts: ['executed: Click the deploy button', 'executed: Click the deploy button'] }));
    expect(decision.kind).toBe('escalate');
    if (decision.kind === 'escalate') {
      expect(decision.reason).toContain('[gcp] phase "Deploy backend"');
      expect(decision.reason).toContain('Attempts: executed: Click the deploy button');
      expect(decision.reason).toContain('Observed: PRISM warning');
      expect(decision.reason).toContain('Already tried:');
      expect(decision.reason).toContain('Take control of the desktop');
      expect(decision.reason.length).toBeLessThanOrEqual(1000);
    }
  });

  it('never renders double dots when summaries already end with periods', () => {
    const decision = loop.decide(context({ streak: 1,
      verificationSummary: 'PRISM warning: No visual change detected on screen after action.',
      priorGuidance: 'Do not repeat it unchanged.' }));
    expect(decision.kind).toBe('escalate');
    if (decision.kind === 'escalate') expect(decision.reason).not.toContain('..');
  });

  it('escalates cleanly without phase context and truncates long inputs', () => {
    const decision = loop.decide(context({ streak: 2, phase: null, priorGuidance: null,
      verificationSummary: 'x'.repeat(2000), recentAttempts: ['y'.repeat(2000)] }));
    expect(decision.kind).toBe('escalate');
    if (decision.kind === 'escalate') {
      expect(decision.reason.startsWith('Stuck. Attempts:')).toBe(true);
      expect(decision.reason.length).toBeLessThanOrEqual(1000);
    }
  });
});
