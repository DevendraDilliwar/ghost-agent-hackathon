import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { RunConfiguration } from '../../../../shared/contracts/task';

interface TaskComposerProps {
  disabled: boolean;
  busy: boolean;
  initialGoal: string;
  initialLimit: number;
  onLaunch: (configuration: RunConfiguration) => void;
}

export function TaskComposer({ disabled, busy, initialGoal, initialLimit, onLaunch }: TaskComposerProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [maxSteps, setMaxSteps] = useState(initialLimit);
  const [screenConsent, setScreenConsent] = useState(false);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(false);
  const canStart = !disabled && !busy && Boolean(goal.trim()) && screenConsent && isolatedEnvironment;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (canStart) onLaunch({ goal: goal.trim(), maxSteps, approvalMode: 'ask_approval', screenConsent, isolatedEnvironment });
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 focus-within:border-indigo-400">
        <label htmlFor="task-goal" className="text-xs font-semibold text-slate-300">What should Ghost Agent do?</label>
        <textarea id="task-goal" value={goal} onChange={event => setGoal(event.target.value)} onKeyDown={keyDown} maxLength={2000} rows={3} disabled={busy}
          placeholder="For example: Type Hello from Ghost Agent in the open blank text editor."
          className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-slate-500" />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-400">This Ubuntu desktop · review each action</span>
          <button type="submit" disabled={!canStart} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? 'Starting…' : 'Start task'}<ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-3 text-xs leading-relaxed text-slate-400">
        <label className="flex items-start gap-2"><input type="checkbox" checked={screenConsent} onChange={event => setScreenConsent(event.target.checked)} disabled={busy} className="mt-0.5" />
          <span>I allow this desktop’s screenshots and my task to be sent to Meta for this run. Keep private content off screen.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={isolatedEnvironment} onChange={event => setIsolatedEnvironment(event.target.checked)} disabled={busy} className="mt-0.5" />
          <span>I am using an isolated test desktop without production accounts or data.</span></label>
      </div>
      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer">Task limits</summary>
        <div className="mt-3 space-y-2 rounded-xl bg-slate-900 p-3">
          <label htmlFor="action-limit" className="flex items-center justify-between gap-3">Maximum actions
            <select id="action-limit" value={maxSteps} onChange={event => setMaxSteps(Number(event.target.value))} disabled={busy} className="rounded border border-slate-700 bg-slate-800 px-2 py-1">
              {[5, 10, 15, 20, 30].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <p>Five-minute total run limit, including pauses and user takeover. Each proposed action needs your approval in this build.</p>
        </div>
      </details>
    </form>
  );
}
