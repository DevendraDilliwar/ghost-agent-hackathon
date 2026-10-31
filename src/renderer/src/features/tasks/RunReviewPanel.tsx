import type { TaskRuntimeView } from './useTaskRuntime';
import { statusLabels } from './task-presentation';
import { VisualGroundingOverlay } from '../overlay/VisualGroundingOverlay';
import { Eye } from 'lucide-react';

export function RunReviewPanel({ runtime }: { runtime: TaskRuntimeView }) {
  const task = runtime.snapshot;
  if (!task?.runId) return null;
  const completed = task.actions.filter(action => action.status === 'executed').length;
  const pendingAction = task.actions.find(action => action.status === 'awaiting_approval');

  return (
    <section aria-label="Current task" className="space-y-4 rounded-2xl border border-white/10 bg-[#0e1424] p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Task Execution Status</p>
          <h2 role="status" className="mt-1 text-sm font-bold text-white">{statusLabels[task.status]}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-slate-800 px-3 py-1 font-mono text-[11px] text-slate-300">
          {completed}/{task.maxSteps} actions
        </span>
      </div>

      {task.messages.filter(item => item.sender === 'user').length > 1 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer font-medium hover:text-slate-300">Your clarifications</summary>
          {task.messages.filter(item => item.sender === 'user').slice(1).map(item => (
            <p key={item.id} className="mt-2 whitespace-pre-wrap break-words">{item.content}</p>
          ))}
        </details>
      )}

      {!['needs_user', 'failed', 'stopped'].includes(task.status) && (
        <p className="text-xs leading-relaxed text-slate-300">{task.message}</p>
      )}

      {task.screenshot && (
        <details open={task.awaitingCompletion || task.status === 'awaiting_approval' || Boolean(pendingAction)} className="space-y-2">
          <summary className="cursor-pointer text-xs font-semibold text-sky-400 flex items-center gap-1.5 hover:text-sky-300">
            <Eye className="h-3.5 w-3.5" />
            <span>{task.awaitingCompletion ? 'Verify Final Desktop State' : 'Live Desktop Screen'}</span>
          </summary>
          <div className="mt-2.5">
            <VisualGroundingOverlay
              screenshot={task.screenshot}
              elements={task.groundedElements ?? []}
              targetCoordinates={pendingAction?.coordinates}
              actionType={pendingAction?.type}
            />
          </div>
        </details>
      )}

      {task.awaitingCompletion && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs leading-relaxed text-slate-300">
            Verify the final screen above against your goal. Confirm the verified outcome below:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={runtime.pending}
              onClick={() => runtime.confirm(true)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 disabled:opacity-40"
            >
              Goal Verified Complete
            </button>
            <button
              type="button"
              disabled={runtime.pending}
              onClick={() => runtime.confirm(false)}
              className="rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
            >
              Task Incomplete / Needs Correction
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
