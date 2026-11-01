import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionCard, combineAnswers } from './QuestionCard';

const questions = [
  { id: 'q1', question: 'Where should I deploy?', options: ['Vercel', 'GCP'] },
  { id: 'q2', question: 'Which repo?', options: [] },
];

describe('QuestionCard', () => {
  it('renders the first question with numbered options and a stepper', () => {
    const html = renderToStaticMarkup(createElement(QuestionCard, { questions, pending: false, onSubmit: vi.fn() }));
    expect(html).toContain('Where should I deploy?');
    expect(html).toContain('1 of 2');
    expect(html).toContain('Vercel');
    expect(html).toContain('Something else…');
    expect(html).toContain('Skip');
    expect(html).toContain('Next');
  });

  it('hides the stepper for a single question and offers to send', () => {
    const html = renderToStaticMarkup(createElement(QuestionCard, { questions: questions.slice(0, 1), pending: false, onSubmit: vi.fn() }));
    expect(html).not.toContain('of 1');
    expect(html).toContain('Send answers &amp; resume');
  });

  it('renders nothing without questions', () => {
    const html = renderToStaticMarkup(createElement(QuestionCard, { questions: [], pending: false, onSubmit: vi.fn() }));
    expect(html).toBe('');
  });
});

describe('combineAnswers', () => {
  it('packs every question with its answer for one re-parse', () => {
    expect(combineAnswers(questions, ['GCP', 'acme/shop'])).toBe('Where should I deploy?: GCP | Which repo?: acme/shop');
  });

  it('marks skipped questions instead of dropping them', () => {
    expect(combineAnswers(questions, [null, null])).toBe('Where should I deploy?: Skipped | Which repo?: Skipped');
  });

  it('always fits the resume limit and strips control characters', () => {
    const long = 'x'.repeat(500);
    const combined = combineAnswers(
      [{ id: 'q1', question: long, options: [] }, { id: 'q2', question: long, options: [] }, { id: 'q3', question: long, options: [] }],
      ['a\0b', long, '  '],
    );
    expect(combined.length).toBeLessThanOrEqual(990);
    expect(combined).not.toContain('\0');
    expect(combined).toContain('ab');
    expect(combined).toContain('Skipped');
  });
});
