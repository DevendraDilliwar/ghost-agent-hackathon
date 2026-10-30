import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import type { RunConfiguration } from '../../../../shared/contracts/task';

interface TaskComposerProps {
  connected: boolean;
  modelReady: boolean;
  ready: boolean;
  busy: boolean;
  initialGoal: string;
  initialLimit: number;
  onOpenSetup: () => void;
  onLaunch: (configuration: RunConfiguration) => void;
}

export function TaskComposer({ connected, modelReady, ready, busy, initialGoal, initialLimit, onOpenSetup, onLaunch }: TaskComposerProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [maxSteps, setMaxSteps] = useState(initialLimit);
  const [screenConsent, setScreenConsent] = useState(false);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(false);
  const canSubmit = connected && !busy && Boolean(goal.trim()) && (!modelReady || (ready && screenConsent && isolatedEnvironment));

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSubmit) return;
    if (!modelReady) { onOpenSetup(); return; }
    onLaunch({ goal: goal.trim(), maxSteps, approvalMode: 'ask_approval', screenConsent, isolatedEnvironment });
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
  }
  return (
    <form onSubmit={submit} aria-label="Send a desktop task" className="space-y-3">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 focus-within:border-indigo-400">
        <label htmlFor="task-goal" className="text-xs font-semibold text-slate-300">Message Ghost Agent</label>
        <textarea id="task-goal" value={goal} onChange={event => setGoal(event.target.value)} onKeyDown={keyDown} maxLength={2000} rows={3} disabled={busy}
          aria-describedby="task-entry-help" placeholder="Tell Ghost Agent what to do on your desktop…"
          className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-slate-500" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</span>
          <button type="submit" disabled={!canSubmit} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? 'Please wait…' : !connected ? 'Desktop app required' : !modelReady ? 'Set up & continue' : !ready ? 'Desktop not ready' : !screenConsent || !isolatedEnvironment ? 'Select permissions below' : 'Send task'}<Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p id="task-entry-help" className="text-[11px] leading-relaxed text-slate-400">{!connected ? 'You can write a draft here. Open the desktop app to run it.' : !modelReady ? 'You can write your task now. Set up & continue opens connection settings and keeps your draft.' : !ready ? 'Your API key is connected. Resolve the desktop check shown above, then choose Recheck desktop.' : 'Select both permissions below, then send your task. You will review each proposed action.'}</p>
      <div className="space-y-2 text-xs leading-relaxed text-slate-400">
        <label className="flex items-start gap-2"><input type="checkbox" checked={screenConsent} onChange={event => setScreenConsent(event.target.checked)} disabled={busy} className="mt-0.5" />
          <span>Allow Meta to process my task and desktop screenshots for this run. Keep private content off screen.</span></label>
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
