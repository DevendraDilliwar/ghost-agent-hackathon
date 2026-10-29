import type { TaskRuntimeView } from './useTaskRuntime';
import { statusLabels } from './task-presentation';

export function RunReviewPanel({ runtime }: { runtime: TaskRuntimeView }) {
  const task = runtime.snapshot;
  if (!task?.runId) return null;
  const completed = task.actions.filter(action => action.status === 'executed').length;
  return (
    <section aria-label="Current task" className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Your task</p>
          <h2 className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">{task.goal}</h2></div>
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-300">{completed}/{task.maxSteps} actions</span>
      </div>
      <p role="status" className="text-xs font-medium text-indigo-200">{statusLabels[task.status]}</p>
      {task.messages.filter(item => item.sender === 'user').length > 1 && <details className="text-xs text-slate-400">
        <summary className="cursor-pointer">Your clarifications</summary>
        {task.messages.filter(item => item.sender === 'user').slice(1).map(item => <p key={item.id} className="mt-2 whitespace-pre-wrap break-words">{item.content}</p>)}
      </details>}
      {!['needs_user', 'failed', 'stopped'].includes(task.status) && <p className="text-xs leading-relaxed text-slate-400">{task.message}</p>}
      {task.screenshot && (
        <details open={task.awaitingCompletion || task.status === 'awaiting_approval'}>
          <summary className="cursor-pointer text-xs text-indigo-300">{task.awaitingCompletion ? 'Review the final screen' : 'Latest screen'}</summary>
          <img src={task.screenshot} alt="Latest observation from your test desktop" className="mt-3 max-h-80 w-full rounded-xl border border-slate-700 object-contain" />
        </details>
      )}
      {task.awaitingCompletion && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-xs leading-relaxed text-slate-300">Compare the final screen with your goal. Confirm the outcome yourself.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={runtime.pending} onClick={() => runtime.confirm(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs disabled:opacity-40">I verified the result</button>
            <button type="button" disabled={runtime.pending} onClick={() => runtime.confirm(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-xs disabled:opacity-40">Task is incomplete</button>
          </div>
        </div>
      )}
    </section>
  );
}
