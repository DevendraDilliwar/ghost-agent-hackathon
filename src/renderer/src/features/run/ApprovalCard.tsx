import { AlertCircle, Bot } from 'lucide-react';
import type { TaskRuntimeView } from './useTaskRuntime';
import { Button } from '../../components/ui/button';

/** Inline approval card: the pending action appears in the chat flow with its decision buttons. */
export function ApprovalCard({ runtime }: { runtime: TaskRuntimeView }) {
  const task = runtime.snapshot;
  const pending = task?.actions.find(action => action.status === 'awaiting_approval');
  if (!task?.runId || !pending) return null;
  return (
    <section aria-label="Review this action" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-amber-600" />
        <h2 className="text-xs font-bold text-amber-800">Review this action</h2>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700">
          <AlertCircle className="h-3 w-3" /> Needs approval
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{pending.description}</p>
      {pending.coordinates && (
        <p className="mt-1 font-mono text-[11px] text-slate-500">
          at ({pending.coordinates.x}, {pending.coordinates.y}){pending.target ? ` · ${pending.target}` : ''}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          disabled={runtime.pending}
          onClick={() => runtime.review(pending.id, false)}
          variant="secondary"
          size="sm"
        >
          Reject &amp; Stop
        </Button>
        <Button
          type="button"
          disabled={runtime.pending}
          onClick={() => runtime.review(pending.id, true)}
          variant="default"
          size="sm"
          className="font-bold"
        >
          <span>Approve &amp; Auto-Run Rest</span>
        </Button>
      </div>
    </section>
  );
}
