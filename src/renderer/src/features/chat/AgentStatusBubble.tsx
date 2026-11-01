import { Bot } from 'lucide-react';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import { isActiveTask, statusLabels } from '../run/task-presentation';

export function AgentStatusBubble({ runtime }: { runtime: TaskRuntimeView }) {
  const task = runtime.snapshot;
  if (!task?.runId || !isActiveTask(task.status)) return null;
  const lastAction = task.actions.at(-1);
  return (
    <article aria-live="polite" className="my-2 flex flex-col items-start gap-2">
      <div className="flex items-center gap-2.5">
        {/* Companion Mascot Badge */}
        <div className="mascot-avatar relative flex h-7 w-7 items-center justify-center rounded-xl bg-linear-to-b from-[#fcd34d] to-[#f59e0b] text-slate-950 shadow-xs border border-amber-300">
          <Bot className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800">Ghost Agent</span>
          <span className="text-[11px] font-medium text-slate-500">· {statusLabels[task.status]}</span>
        </div>
      </div>

      <div className="rounded-2xl rounded-tl-sm border border-slate-200/80 bg-white p-3.5 shadow-xs max-w-[95%]">
        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{task.message}</p>
        {lastAction && ['executed', 'failed'].includes(lastAction.status) && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-500 font-mono">
            <span>Last step: {lastAction.description}</span>
          </div>
        )}
      </div>
    </article>
  );
}
