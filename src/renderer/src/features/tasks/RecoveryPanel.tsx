import type { TaskRuntimeView } from './useTaskRuntime';

export function RecoveryPanel({ runtime, onOpenSetup }: { runtime: TaskRuntimeView; onOpenSetup: () => void }) {
  const task = runtime.snapshot;
  if (!task || !['failed', 'stopped'].includes(task.status)) return null;
  return (
    <section aria-label="Task recovery" className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-950/10 p-4">
      <h2 className="text-sm font-semibold">{task.status === 'failed' ? 'This task needs attention' : 'You stopped this task'}</h2>
      <p role="status" className="text-xs leading-relaxed text-rose-200">{task.message}</p>
      <p className="text-xs leading-relaxed text-slate-400">{task.actions.length === 0
        ? 'Ghost Agent did not send any mouse or keyboard input in this run. Your goal is kept below so you can review it and try again.'
        : 'The desktop has not been reset. Inspect what changed before starting a new attempt. Your goal is kept below so you can edit it; no action will be replayed automatically.'}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => document.getElementById('task-goal')?.focus()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs">Review goal</button>
        <button type="button" onClick={onOpenSetup} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Check setup</button>
      </div>
    </section>
  );
}
