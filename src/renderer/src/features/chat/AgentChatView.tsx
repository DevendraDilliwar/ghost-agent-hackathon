import { useState } from 'react';
import { ActionTimeline } from '../timeline/ActionTimeline';
import { ConnectionSetup } from '../environment/ConnectionSetup';
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
  const ready = runtime.connected && runtime.readiness?.ready === true;
  const history = task?.actions.filter(action => action.status !== 'awaiting_approval') ?? [];
  const pending = task?.actions.filter(action => action.status === 'awaiting_approval') ?? [];

  return (
    <section className="glass-panel-elevated flex h-[calc(100dvh-7rem)] min-h-[460px] w-full flex-col overflow-hidden rounded-3xl border border-slate-700/80">
      <ChatHeader status={status} connected={runtime.connected} ready={runtime.readiness?.ready} onOpenSetup={() => setShowSetup(!showSetup)} onCompact={runtime.showControls} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        {!runtime.connected && <p className="rounded-xl border border-amber-500/30 p-3 text-xs leading-relaxed text-amber-200">Browser layout preview. Open the installed desktop app to connect Meta and operate your test desktop.</p>}
        {runtime.connected && !runtime.readiness && <p role="status" className="text-xs text-slate-400">Checking your desktop…</p>}
        {runtime.connected && !active && (showSetup || (runtime.readiness && !ready)) && <ConnectionSetup runtime={runtime} />}
        {showSetup && active && <p className="rounded-xl border border-slate-700 p-3 text-xs text-slate-400">Stop this task to edit connection settings. Screen capture is paused only when you choose Pause or Take control.</p>}
        {!runtime.connected && showSetup && <p className="text-xs text-slate-400">Connection settings are available in the desktop app.</p>}
        {runtime.error && <p role="alert" className="rounded-xl border border-rose-500/30 p-3 text-xs text-rose-300">{runtime.error}</p>}
        {!task?.runId && <MessageFeed messages={[]} />}
        <RunReviewPanel runtime={runtime} />
        <HandoffPanel key={task?.revision ?? 0} runtime={runtime} />
        <RecoveryPanel runtime={runtime} onOpenSetup={() => setShowSetup(true)} />
        {task?.awaitingCompletion && <MessageFeed messages={task.messages.filter(item => item.sender !== 'user')} />}
        {pending.length > 0 && <section aria-label="Next action"><h2 className="mb-3 text-xs font-semibold text-amber-200">Review before Ghost Agent acts</h2>
          <ActionTimeline actions={pending} disabled={runtime.pending} onApproveAction={id => runtime.review(id, true)} onRejectAction={id => runtime.review(id, false)} />
        </section>}
        {task?.runId && <details className="rounded-xl border border-slate-800 p-4 text-xs text-slate-400">
          <summary className="cursor-pointer">Activity & technical details · {history.length} records</summary>
          <p className="my-3">{task.inputTokens + task.outputTokens} reported tokens · {task.inputTokens} input / {task.outputTokens} output</p>
          {history.length > 0 ? <ActionTimeline actions={history} /> : <p>No actions have executed yet.</p>}
        </details>}
      </div>
      <footer className="shrink-0 border-t border-slate-800/80 bg-slate-950/60 p-5 sm:p-6">
        {active ? <RunControls status={status} disabled={runtime.pending} onPause={runtime.pause} onResume={runtime.resume} onStop={runtime.stop} onTakeOver={runtime.takeOver} />
          : <TaskComposer key={task?.runId ?? 'new'} initialGoal={task?.goal ?? ''} initialLimit={task?.maxSteps ?? 15} busy={runtime.pending} disabled={!ready} onLaunch={runtime.launch} />}
      </footer>
    </section>
  );
}
