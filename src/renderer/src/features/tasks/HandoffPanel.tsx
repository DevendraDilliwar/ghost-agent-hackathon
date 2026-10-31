import { Hand } from 'lucide-react';
import { useState } from 'react';
import type { TaskRuntimeView } from './useTaskRuntime';
import { Button } from '../../components/ui/button';

export function HandoffPanel({ runtime }: { runtime: TaskRuntimeView }) {
  const [answer, setAnswer] = useState('');
  const task = runtime.snapshot;
  if (task?.status !== 'needs_user' || !task.handoff) return null;
  const title = task.handoff.kind === 'verification' ? 'Complete verification yourself'
    : task.handoff.kind === 'login' ? 'Sign in yourself' : task.handoff.kind === 'clarification' ? 'One question before I continue' : 'Your turn at the desktop';
  const clarification = task.handoff.kind === 'clarification';
  return (
    <section aria-labelledby="handoff-title" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h2 id="handoff-title" className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Hand className="h-5 w-5" />{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{task.handoff.reason}</p>
      <p className="text-xs leading-relaxed text-slate-500">Agent input, new screenshots, and new model requests are paused. {clarification ? 'Your answer will be sent to Meta when you resume. Do not enter passwords, verification codes, or other secrets here.' : 'Complete the step in the target app, then close any private content before returning control.'} The five-minute run limit still applies.</p>
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
