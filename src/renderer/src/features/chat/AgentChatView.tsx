import { useState } from 'react';
import { ActionTimeline } from '../timeline/ActionTimeline';
import { ConnectionDialog } from '../environment/ConnectionDialog';
import { TaskComposer } from '../tasks/TaskComposer';
import { RunControls } from '../tasks/RunControls';
import { RunReviewPanel } from '../tasks/RunReviewPanel';
import { HandoffPanel } from '../tasks/HandoffPanel';
import { RecoveryPanel } from '../tasks/RecoveryPanel';
import { isActiveTask } from '../tasks/task-presentation';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';

export function AgentChatView({ runtime }: { runtime: TaskRuntimeView }) {
  const [showSetup, setShowSetup] = useState(false);
  const task = runtime.snapshot;
  const status = task?.status ?? 'idle';
  const active = isActiveTask(status);
  const modelReady = runtime.connection?.verified === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;
  const history = task?.actions.filter(action => action.status !== 'awaiting_approval') ?? [];
  const pending = task?.actions.filter(action => action.status === 'awaiting_approval') ?? [];

  return (
    <section className="glass-panel-elevated flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-slate-700/80">
      <ChatHeader status={status} connected={runtime.connected} ready={runtime.readiness?.ready} settingsDisabled={active} onOpenSetup={() => setShowSetup(true)} onCompact={runtime.showControls} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        {!runtime.connected && <p className="rounded-xl border border-amber-500/30 p-3 text-xs leading-relaxed text-amber-200">Browser layout preview. Open the installed desktop app to connect Meta and operate your test desktop.</p>}
        {ready && !active && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs leading-relaxed text-emerald-200">Desktop connected. Write your task, select both permissions below, then send. Emergency Stop: {runtime.readiness?.emergencyStopShortcut}.</p>}
        {runtime.connected && !ready && !active && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3">
          <div className="space-y-2 text-xs leading-relaxed text-slate-300">
            <p>{modelReady ? 'Meta is connected. Complete the desktop checks below before running a task; your API key does not need to be entered again.' : 'Write your task below. Complete connection setup before Ghost Agent can run it.'}</p>
            {modelReady && runtime.readiness && runtime.readiness.issues.length > 0 && <ul className="list-disc space-y-1 pl-4 text-amber-200">{runtime.readiness.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
          </div>
          <button type="button" onClick={modelReady ? runtime.refresh : () => setShowSetup(true)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold">{modelReady ? 'Recheck desktop' : 'Set up connection'}</button>
        </div>}
        {runtime.error && <p role="alert" className="rounded-xl border border-rose-500/30 p-3 text-xs text-rose-300">{runtime.error}</p>}
        <MessageFeed messages={task?.messages ?? []} />
        <RunReviewPanel runtime={runtime} />
        <HandoffPanel key={task?.revision ?? 0} runtime={runtime} />
        <RecoveryPanel runtime={runtime} onOpenSetup={() => setShowSetup(true)} />
        {pending.length > 0 && <section aria-label="Next action"><h2 className="mb-3 text-xs font-semibold text-amber-200">Review before Ghost Agent acts</h2>
          <ActionTimeline actions={pending} disabled={runtime.pending} onApproveAction={id => runtime.review(id, true)} onRejectAction={id => runtime.review(id, false)} />
        </section>}
        {task?.runId && <details className="rounded-xl border border-slate-800 p-4 text-xs text-slate-400">
          <summary className="cursor-pointer">Activity & technical details · {history.length} records</summary>
          <p className="my-3">{task.inputTokens + task.outputTokens} reported tokens · {task.inputTokens} input / {task.outputTokens} output</p>
          {history.length > 0 ? <ActionTimeline actions={history} /> : <p>No actions have executed yet.</p>}
        </details>}
      </div>
      <footer className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-slate-800/80 bg-slate-950/60 p-4 sm:p-5">
        {active && <RunControls status={status} disabled={runtime.pending} emergencyStopShortcut={runtime.readiness?.emergencyStopShortcut ?? null} onPause={runtime.pause} onResume={runtime.resume} onStop={runtime.stop} onTakeOver={runtime.takeOver} />}
        {!active && <TaskComposer key={task?.runId ?? 'new'} initialGoal={task?.goal ?? ''} initialLimit={task?.maxSteps ?? 15} busy={runtime.pending} connected={runtime.connected} modelReady={modelReady} ready={ready} onOpenSetup={() => setShowSetup(true)} onLaunch={runtime.launch} />}
      </footer>
      <ConnectionDialog open={showSetup && !active} runtime={runtime} onClose={() => setShowSetup(false)} />
    </section>
  );
}
