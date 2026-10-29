import { Hand } from 'lucide-react';
import { useState } from 'react';
import type { TaskRuntimeView } from './useTaskRuntime';

export function HandoffPanel({ runtime }: { runtime: TaskRuntimeView }) {
  const [answer, setAnswer] = useState('');
  const task = runtime.snapshot;
  if (task?.status !== 'needs_user' || !task.handoff) return null;
  const title = task.handoff.kind === 'verification' ? 'Complete verification yourself'
    : task.handoff.kind === 'login' ? 'Sign in yourself' : task.handoff.kind === 'clarification' ? 'One question before I continue' : 'Your turn at the desktop';
  const clarification = task.handoff.kind === 'clarification';
  return (
    <section aria-labelledby="handoff-title" className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5">
      <h2 id="handoff-title" className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Hand className="h-5 w-5" />{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{task.handoff.reason}</p>
      <p className="text-xs leading-relaxed text-slate-400">Agent input, new screenshots, and new model requests are paused. {clarification ? 'Your answer will be sent to Meta when you resume. Do not enter passwords, verification codes, or other secrets here.' : 'Complete the step in the target app, then close any private content before returning control.'} The five-minute run limit still applies.</p>
      {clarification && <label className="block text-xs text-slate-300">Your answer
        <textarea value={answer} onChange={event => setAnswer(event.target.value)} maxLength={1000} rows={2} disabled={runtime.pending}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none" />
      </label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={runtime.pending || (clarification && !answer.trim())} onClick={() => {
          if (clarification) runtime.answerAndResume(answer); else runtime.resume();
        }} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{clarification ? 'Send answer & resume' : 'Done — resume agent'}</button>
        <button type="button" onClick={runtime.showControls} className="rounded-xl border border-slate-600 px-4 py-2 text-xs">Show desktop controls</button>
      </div>
    </section>
  );
}
