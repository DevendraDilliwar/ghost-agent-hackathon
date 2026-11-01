import { Bot } from 'lucide-react';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import { isActiveTask, statusLabels } from '../run/task-presentation';

/** Live agent bubble: keeps the thread breathing while a task runs. */
export function AgentStatusBubble({ runtime }: { runtime: TaskRuntimeView }) {
  const task = runtime.snapshot;
  if (!task?.runId || !isActiveTask(task.status)) return null;
  const lastAction = task.actions.at(-1);
  return (
    <article aria-live="polite" className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2 px-1">
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white">
          <Bot className="h-2.5 w-2.5" />
        </div>
        <span className="text-[10px] font-medium text-slate-500">
          NoMCP Agent · {statusLabels[task.status]}
        </span>
      </div>
      <div className="max-w-[95%] py-1 text-sm leading-relaxed text-slate-800">
        <p className="whitespace-pre-wrap">{task.message}</p>
        {lastAction && ['executed', 'failed'].includes(lastAction.status) && (
          <p className="mt-1 text-xs text-slate-500">Last step: {lastAction.description}</p>
        )}
      </div>
    </article>
  );
}
