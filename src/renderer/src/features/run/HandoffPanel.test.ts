import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandoffPanel, parseRecoveryStory } from './HandoffPanel';
import type { TaskRuntimeView } from './useTaskRuntime';

const full = 'Stuck on [gcp] phase "Deploy backend". Attempts: executed: Click the deploy button | executed: Click the deploy button. ' +
  'Observed: PRISM warning: No visual change detected on screen after action. Already tried: The last action caused no visible change. ' +
  'Take control of the desktop, fix the screen, then resume - or stop the run.';

describe('parseRecoveryStory', () => {
  it('splits a full escalation story into sections', () => {
    const story = parseRecoveryStory(full);
    expect(story?.head).toBe('Stuck on [gcp] phase "Deploy backend".');
    expect(story?.attempts).toEqual(['executed: Click the deploy button', 'executed: Click the deploy button']);
    expect(story?.observed).toBe('PRISM warning: No visual change detected on screen after action');
    expect(story?.tried).toBe('The last action caused no visible change');
    expect(story?.next).toBe('Take control of the desktop, fix the screen, then resume - or stop the run.');
  });

  it('parses stories without an already-tried section', () => {
    const story = parseRecoveryStory('Stuck. Attempts: executed: Click it. Observed: Nothing changed. Take control of the desktop now.');
    expect(story?.tried).toBeNull();
    expect(story?.observed).toBe('Nothing changed');
    expect(story?.next).toBe('Take control of the desktop now.');
  });

  it.each([
    'You have control of the desktop. Finish your step, then return control to Ghost Agent.',
    '',
    'Stuck on something vague with no sections at all',
    'Stuck. Attempts: foo.',
  ])('falls back to plain text for non-story reasons', reason => {
    expect(parseRecoveryStory(reason)).toBeNull();
  });
});

describe('HandoffPanel questions', () => {
  it('renders a suggested-answer dropdown for structured questions', () => {
    const runtime = {
      snapshot: {
        runId: 'run-1', status: 'needs_user', maxMinutes: 5, pendingActionId: null, message: '',
        handoff: { kind: 'clarification', reason: 'Where should I deploy?',
          questions: [{ id: 'q1', question: 'Where should I deploy?', options: ['Vercel', 'GCP'] }] },
      },
      pending: false,
    } as unknown as TaskRuntimeView;
    const html = renderToStaticMarkup(createElement(HandoffPanel, { runtime }));
    expect(html).toContain('Suggested answers');
    expect(html).toContain('Vercel');
    expect(html).toContain('GCP');
  });
});
