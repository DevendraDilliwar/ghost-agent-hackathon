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
import { ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

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
    <section className="glass-panel-elevated flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 shadow-2xl backdrop-blur-2xl">
      <ChatHeader
        status={status}
        connected={runtime.connected}
        ready={runtime.readiness?.ready}
        settingsDisabled={active}
        onOpenSetup={() => setShowSetup(true)}
        onCompact={runtime.showControls}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {!runtime.connected && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Browser UI preview mode. Open the installed desktop app to operate your native desktop session.</span>
          </div>
        )}

        {ready && !active && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200 shadow-sm shadow-emerald-500/10">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Universal Desktop runtime ready. Emergency stop hotkey: <kbd className="rounded bg-emerald-900/60 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-200">{runtime.readiness?.emergencyStopShortcut ?? 'Ctrl+Alt+S'}</kbd></span>
            </div>
          </div>
        )}

        {runtime.connected && !ready && !active && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/25 p-3.5 shadow-sm">
            <div className="space-y-1.5 text-xs text-slate-300">
              <p className="font-medium">
                {modelReady
                  ? 'Meta Model API connected. Complete desktop permission checks below.'
                  : 'Connect your Meta API key to enable autonomous vision & planning.'}
              </p>
              {modelReady && runtime.readiness && runtime.readiness.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-amber-200 text-[11px]">
                  {runtime.readiness.issues.map(issue => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={modelReady ? runtime.refresh : () => setShowSetup(true)}
              className="flex items-center gap-1.5 shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-500"
            >
              <span>{modelReady ? 'Recheck System' : 'Setup Connection'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {runtime.error && (
          <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-950/30 p-3.5 text-xs text-rose-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{runtime.error}</span>
          </div>
        )}

        <MessageFeed messages={task?.messages ?? []} />
        <RunReviewPanel runtime={runtime} />
        <HandoffPanel key={task?.revision ?? 0} runtime={runtime} />
        <RecoveryPanel runtime={runtime} onOpenSetup={() => setShowSetup(true)} />

        {pending.length > 0 && (
          <section aria-label="Next action" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Action Verification Gate (Human in the Loop)
              </h2>
            </div>
            <ActionTimeline
              actions={pending}
              disabled={runtime.pending}
              onApproveAction={id => runtime.review(id, true)}
              onRejectAction={id => runtime.review(id, false)}
            />
          </section>
        )}

        {task?.runId && (
          <details className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-xs text-slate-400">
            <summary className="cursor-pointer font-medium hover:text-slate-300">
              📊 Execution Journal & Token Audit · {history.length} operations recorded
            </summary>
            <p className="my-2.5 font-mono text-[11px] text-slate-400">
              {task.inputTokens + task.outputTokens} tokens used ({task.inputTokens} prompt / {task.outputTokens} response)
            </p>
            {history.length > 0 ? (
              <ActionTimeline actions={history} />
            ) : (
              <p className="text-[11px] text-slate-500">No actions executed yet.</p>
            )}
          </details>
        )}
      </div>

      <footer className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl sm:p-5">
        {active && (
          <RunControls
            status={status}
            disabled={runtime.pending}
            emergencyStopShortcut={runtime.readiness?.emergencyStopShortcut ?? null}
            onPause={runtime.pause}
            onResume={runtime.resume}
            onStop={runtime.stop}
            onTakeOver={runtime.takeOver}
          />
        )}
        {!active && (
          <TaskComposer
            key={task?.runId ?? 'new'}
            initialGoal={task?.goal ?? ''}
            initialLimit={task?.maxSteps ?? 15}
            busy={runtime.pending}
            connected={runtime.connected}
            modelReady={modelReady}
            ready={ready}
            onOpenSetup={() => setShowSetup(true)}
            onLaunch={runtime.launch}
          />
        )}
      </footer>

      <ConnectionDialog open={showSetup && !active} runtime={runtime} onClose={() => setShowSetup(false)} />
    </section>
  );
}
