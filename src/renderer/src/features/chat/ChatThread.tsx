import { AlertTriangle, ArrowRight, Sparkles, CheckCircle2, Download, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ActionTimeline } from '../run/ActionTimeline';
import { ApprovalCard } from '../run/ApprovalCard';
import { HandoffPanel } from '../run/HandoffPanel';
import { RecoveryPanel } from '../run/RecoveryPanel';
import { RunReviewPanel } from '../run/RunReviewPanel';
import { isActiveTask } from '../run/task-presentation';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import { AgentStatusBubble } from './AgentStatusBubble';
import { MessageFeed } from './MessageFeed';

interface ChatThreadProps {
  runtime: TaskRuntimeView;
  onOpenSetup: () => void;
}

/** Scrollable conversation thread: status banners, messages, inline cards, live activity. */
export function ChatThread({ runtime, onOpenSetup }: ChatThreadProps) {
  const task = runtime.snapshot;
  const active = isActiveTask(task?.status ?? 'idle');
  const modelReady = runtime.connection?.verified === true;
  const keyPresent = runtime.connection?.configured === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;

  return (
    <div className="chat-thread">
      <div className="chat-thread-content space-y-4">
        {!runtime.connected && !active && (
          <div className="chat-preview-notice">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Browser UI preview mode. Open the installed desktop app to operate your native desktop session.</span>
          </div>
        )}

        {ready && !active && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Ready · Stop: <kbd className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800">{runtime.readiness?.emergencyStopShortcut ?? 'Ctrl+Alt+S'}</kbd></span>
          </div>
        )}

        {runtime.connected && !ready && !active && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="space-y-1.5 text-xs text-slate-700">
              <p className="font-medium">
                {modelReady
                  ? 'Meta Model API connected. Complete desktop permission checks below.'
                  : keyPresent
                    ? 'Saved API key found. Verifying the connection automatically…'
                    : 'Connect your Meta API key to enable autonomous vision & planning.'}
              </p>
              {modelReady && runtime.readiness && runtime.readiness.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-amber-700 text-[11px]">
                  {runtime.readiness.issues.map(issue => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              type="button"
              onClick={modelReady || keyPresent ? runtime.refresh : onOpenSetup}
              variant="default"
              size="sm"
              className="shrink-0 font-bold"
            >
              <span>{modelReady ? 'Recheck System' : keyPresent ? 'Recheck Now' : 'Setup Connection'}</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {runtime.error && (
          <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{runtime.error}</span>
          </div>
        )}

        {!task?.runId && (
          <div className="chat-welcome">
            <span className="welcome-spark" aria-hidden="true"><Sparkles /></span>
            <p className="welcome-eyebrow">Your desktop, a little more effortless.</p>
            <h2>What should I do on your desktop?</h2>
            <p>Describe a task. I’ll work with the apps on your screen.</p>
          </div>
        )}

        <MessageFeed messages={task?.messages ?? []} />

        {task?.screenshot && !task.awaitingCompletion && (
          <figure className="message-image">
            <img src={task.screenshot} alt="Latest desktop screenshot from the current task" />
            <a className="image-download" href={task.screenshot} download="nomcp-desktop.png" aria-label="Download latest desktop screenshot"><Download size={19} /></a>
          </figure>
        )}
        {task?.awaitingCompletion && <RunReviewPanel runtime={runtime} />}
        <ApprovalCard runtime={runtime} />
        <HandoffPanel key={task?.revision ?? 0} runtime={runtime} />
        <RecoveryPanel runtime={runtime} onOpenSetup={onOpenSetup} />
        <AgentStatusBubble runtime={runtime} />

        {active && task && task.actions.length > 0 && (
          <section aria-label="Live activity" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-bold text-slate-700">Live activity</h2>
            <ActionTimeline actions={task.actions} />
          </section>
        )}
      </div>
    </div>
  );
}
