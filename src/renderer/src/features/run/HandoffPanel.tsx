import { Hand } from 'lucide-react';
import { useState } from 'react';
import type { TaskRuntimeView } from './useTaskRuntime';
import { Button } from '../../components/ui/button';

interface RecoveryStory {
  head: string;
  attempts: string[];
  observed: string;
  tried: string | null;
  next: string;
}

/** Parses the self-fix loop's escalation format; null for anything else. */
export function parseRecoveryStory(reason: string): RecoveryStory | null {
  if (!reason.startsWith('Stuck')) return null;
  const attemptsIdx = reason.indexOf('. Attempts: ');
  const observedIdx = reason.indexOf('. Observed: ');
  const nextIdx = reason.indexOf('Take control of the desktop');
  if (attemptsIdx < 0 || observedIdx <= attemptsIdx || nextIdx <= observedIdx) return null;
  const triedIdx = reason.indexOf('. Already tried: ');
  const head = reason.slice(0, attemptsIdx + 1);
  const attempts = reason.slice(attemptsIdx + '. Attempts: '.length, observedIdx).split(' | ').map(part => part.trim()).filter(Boolean);
  const observedStart = observedIdx + '. Observed: '.length;
  const tried = triedIdx > observedIdx ? reason.slice(triedIdx + '. Already tried: '.length, nextIdx - 2).trim() : null;
  const observed = reason.slice(observedStart, triedIdx > observedIdx ? triedIdx : nextIdx - 2).trim();
  const next = reason.slice(nextIdx).trim();
  if (!head || attempts.length === 0 || !observed || !next) return null;
  return { head, attempts, observed, tried: tried || null, next };
}

export function HandoffPanel({ runtime }: { runtime: TaskRuntimeView }) {
  const [answer, setAnswer] = useState('');
  const task = runtime.snapshot;
  if (task?.status !== 'needs_user' || !task.handoff) return null;
  const title = task.handoff.kind === 'verification' ? 'Complete verification yourself'
    : task.handoff.kind === 'login' ? 'Sign in yourself' : task.handoff.kind === 'clarification' ? 'One question before I continue' : 'Your turn at the desktop';
  const clarification = task.handoff.kind === 'clarification';
  const story = task.handoff.kind === 'manual' ? parseRecoveryStory(task.handoff.reason) : null;
  return (
    <section aria-labelledby="handoff-title" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h2 id="handoff-title" className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Hand className="h-5 w-5" />{title}</h2>
      {story ? (
        <dl className="space-y-2 text-sm leading-relaxed text-slate-800">
          <div><dt className="text-[11px] font-bold uppercase tracking-wide text-amber-700">What happened</dt><dd>{story.head}</dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Attempts</dt>
            <dd><ul className="list-disc pl-4">{story.attempts.map((attempt, index) => <li key={attempt + index}>{attempt}</li>)}</ul></dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Observed</dt><dd>{story.observed}</dd></div>
          {story.tried && <div><dt className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Already tried</dt><dd>{story.tried}</dd></div>}
          <div><dt className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Next step</dt><dd>{story.next}</dd></div>
        </dl>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{task.handoff.reason}</p>
      )}
      <p className="text-xs leading-relaxed text-slate-500">Agent input, new screenshots, and new model requests are paused. {clarification ? 'Your answer will be sent to Meta when you resume. Do not enter passwords, verification codes, or other secrets here.' : 'Complete the step in the target app, then close any private content before returning control.'} The {task.maxMinutes}-minute run limit still applies.</p>
      {clarification && <label className="block text-xs text-slate-600">Your answer
        <textarea value={answer} onChange={event => setAnswer(event.target.value)} maxLength={1000} rows={2} disabled={runtime.pending}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none" />
      </label>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={runtime.pending || (clarification && !answer.trim())} onClick={() => {
          if (clarification) runtime.answerAndResume(answer); else runtime.resume();
        }} variant="warning" size="sm">{clarification ? 'Send answer & resume' : 'Done — resume agent'}</Button>
        <Button type="button" onClick={runtime.showControls} variant="secondary" size="sm">Show desktop controls</Button>
      </div>
    </section>
  );
}
