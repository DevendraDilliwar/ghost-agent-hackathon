import { Check, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { useState } from 'react';
import type { ClarificationQuestion } from '../../../../shared/contracts/task';
import { Button } from '../../components/ui/button';

/**
 * Packs every answered question into the single clarification string the run
 * resumes with, so one model re-parse sees the full context. Skipped questions
 * are marked, never dropped silently. Always fits the 1000-char resume limit.
 */
export function combineAnswers(questions: readonly ClarificationQuestion[], answers: readonly (string | null)[]): string {
  return questions.map((entry, index) => {
    const reply = (answers[index] ?? '').replace(/\0/g, '').trim() || 'Skipped';
    return (entry.question.slice(0, 150) + ': ' + reply.slice(0, 150)).slice(0, 320);
  }).join(' | ').slice(0, 990);
}

interface QuestionCardProps {
  questions: ClarificationQuestion[];
  pending: boolean;
  onSubmit: (combined: string) => void;
}

/**
 * Steps through all model questions one by one: numbered tappable options,
 * a custom-answer row, per-question drafts, and Skip. Answers stay put while
 * stepping back and forth; the last step sends everything in one resume.
 */
export function QuestionCard({ questions, pending, onSubmit }: QuestionCardProps) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => questions.map(() => null));
  const [drafts, setDrafts] = useState<string[]>(() => questions.map(() => ''));
  const current = questions[index];
  if (!current) return null;
  const last = index === questions.length - 1;

  const resolve = (at: number): string | null => {
    const draft = drafts[at]?.trim();
    if (draft) return draft;
    return picks[at] ?? null;
  };

  const go = (at: number): void => {
    if (at < 0 || at >= questions.length) return;
    setIndex(at);
  };

  const advance = (): void => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    onSubmit(combineAnswers(questions, questions.map((_, at) => resolve(at))));
  };

  const skip = (): void => {
    setPicks(picks.map((pick, at) => (at === index ? null : pick)));
    setDrafts(drafts.map((draft, at) => (at === index ? '' : draft)));
    if (!last) setIndex(index + 1);
    else onSubmit(combineAnswers(questions, questions.map((_, at) => (at === index ? null : resolve(at)))));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" role="group" aria-label="Clarification questions"
      onKeyDown={event => {
        const digit = Number.parseInt(event.key, 10);
        if (Number.isInteger(digit) && digit >= 1 && digit <= current.options.length && !pending) {
          const option = current.options[digit - 1];
          if (option !== undefined) setPicks(picks.map((pick, at) => (at === index ? option : pick)));
        }
      }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{current.question}</p>
        {questions.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-slate-500">
            <button type="button" aria-label="Previous question" disabled={pending || index === 0} onClick={() => go(index - 1)}
              className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums">{index + 1} of {questions.length}</span>
            <button type="button" aria-label={last ? 'Send answers' : 'Next question'} disabled={pending} onClick={advance}
              className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {current.options.length > 0 && (
        <div className="mt-3 space-y-1" role="radiogroup" aria-label="Suggested answers">
          {current.options.map((option, order) => {
            const selected = picks[index] === option && !drafts[index]?.trim();
            return (
              <button key={option + order} type="button" role="radio" aria-checked={selected} disabled={pending}
                onClick={() => setPicks(picks.map((pick, at) => (at === index ? (pick === option ? null : option) : pick)))}
                className={'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ' +
                  (selected ? 'border-slate-900 bg-slate-100 font-medium text-slate-900' : 'border-slate-200 text-slate-800 hover:bg-slate-100')}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-600">{order + 1}</span>
                <span className="flex-1">{option}</span>
                {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-700" />}
              </button>
            );
          })}
        </div>
      )}
      <label className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
        <PenLine aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
        <input value={drafts[index] ?? ''} disabled={pending} maxLength={300} placeholder="Something else…"
          aria-label="Custom answer"
          onChange={event => setDrafts(drafts.map((draft, at) => (at === index ? event.target.value : draft)))}
          onKeyDown={event => { if (event.key === 'Enter') advance(); }}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500" />
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {resolve(index) ? 'Answer ready.' : current.options.length ? 'Pick a suggestion, type your own, or skip.' : 'Type your answer, or skip.'}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={skip}>Skip</Button>
          <Button type="button" variant="warning" size="sm" disabled={pending} onClick={advance}>{last ? 'Send answers & resume' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}
