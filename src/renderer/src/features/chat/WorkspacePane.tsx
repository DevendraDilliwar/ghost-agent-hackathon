import { ActionTimeline } from '../timeline/ActionTimeline';
import { RunReviewPanel } from '../tasks/RunReviewPanel';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';
import type { AgentAction } from '../../../../shared/contracts/task';

interface WorkspacePaneProps {
  runtime: TaskRuntimeView;
  history: AgentAction[];
}

export function WorkspacePane({ runtime, history }: WorkspacePaneProps) {
  const task = runtime.snapshot;
  if (!task?.runId) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h2 className="text-sm font-bold text-slate-800">Live workspace</h2>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
          Start a task from the chat. Screenshots, steps, and verification evidence will appear here as the agent works.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <RunReviewPanel runtime={runtime} />
      {task.intent && (
        <section aria-label="Understood intent" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700">Understood</h3>
          <p className="mt-1 text-xs text-slate-600">{task.intent.summary}</p>
          {Object.keys(task.intent.params).length > 0 && (
            <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {Object.entries(task.intent.params).map(([name, value]) => (
                <div key={name} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px]">
                  <dt className="font-medium text-slate-500">{name}</dt>
                  <dd className="font-mono text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      <section aria-label="Steps" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700">Steps</h3>
          <span className="font-mono text-[11px] text-slate-500">{task.inputTokens + task.outputTokens} tokens</span>
        </div>
        {history.length > 0 ? (
          <ActionTimeline actions={history} />
        ) : (
          <p className="text-[11px] text-slate-500">No actions yet.</p>
        )}
      </section>
    </div>
  );
}
