import { useState } from 'react';
import { ActionTimeline } from '../timeline/ActionTimeline';
import { TaskComposer } from '../tasks/TaskComposer';
import { RunControls } from '../tasks/RunControls';
import { HandoffPanel } from '../tasks/HandoffPanel';
import { RecoveryPanel } from '../tasks/RecoveryPanel';
import { isActiveTask } from '../tasks/task-presentation';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';
import type { ApprovalMode } from '../../../../shared/contracts/task';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';
import { WorkspacePane } from './WorkspacePane';
import { SettingsOverlay } from './SettingsOverlay';
import { ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

export function AgentChatView({ runtime }: { runtime: TaskRuntimeView }) {
  const [showSetup, setShowSetup] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('full_access');
  const [screenConsent, setScreenConsent] = useState(true);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(true);
  const [maxSteps, setMaxSteps] = useState(15);
  const task = runtime.snapshot;
  const status = task?.status ?? 'idle';
  const active = isActiveTask(status);
  const modelReady = runtime.connection?.verified === true;
  const keyPresent = runtime.connection?.configured === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;
  // Settings always opens on live state, never on a stale mount-time snapshot.
  const openSetup = () => { runtime.refresh(); setShowSetup(true); };
  const history = task?.actions.filter(action => action.status !== 'awaiting_approval') ?? [];
  const pending = task?.actions.filter(action => action.status === 'awaiting_approval') ?? [];
  const tokens = (task?.inputTokens ?? 0) + (task?.outputTokens ?? 0);

  return (
    <section className="glass-panel-elevated relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <ChatHeader
        status={status}
        connected={runtime.connected}
        ready={runtime.readiness?.ready}
        settingsDisabled={active}
        tokens={tokens}
        showStop={active}
        onStop={runtime.stop}
        onOpenSetup={openSetup}
        onCompact={runtime.showControls}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 w-full flex-1 flex-col border-b border-slate-200 lg:w-[400px] lg:flex-none lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {!runtime.connected && !active && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
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
                  onClick={modelReady || keyPresent ? runtime.refresh : openSetup}
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

            <MessageFeed messages={task?.messages ?? []} />

            {pending.length > 0 && (
              <section aria-label="Next action" className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Review this action
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

            <HandoffPanel key={task?.revision ?? 0} runtime={runtime} />
            <RecoveryPanel runtime={runtime} onOpenSetup={openSetup} />
          </div>

          <footer className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-slate-200 bg-white p-4 sm:p-5">
            {active && (
              <RunControls
                status={status}
                disabled={runtime.pending}
                emergencyStopShortcut={runtime.readiness?.emergencyStopShortcut ?? null}
                onPause={runtime.pause}
                onResume={runtime.resume}
                onTakeOver={runtime.takeOver}
              />
            )}
            {!active && (
              <TaskComposer
                key={task?.runId ?? 'new'}
                initialGoal={task?.goal ?? ''}
                approvalMode={approvalMode}
                screenConsent={screenConsent}
                isolatedEnvironment={isolatedEnvironment}
                maxSteps={maxSteps}
                busy={runtime.pending}
                connected={runtime.connected}
                modelReady={modelReady}
                ready={ready}
                onOpenSetup={openSetup}
                onLaunch={runtime.launch}
              />
            )}
          </footer>
        </div>

        <div className="min-h-[280px] flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          <WorkspacePane runtime={runtime} history={history} />
        </div>
      </div>

      {showSetup && !active && (
        <SettingsOverlay
          runtime={runtime}
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
          screenConsent={screenConsent}
          setScreenConsent={setScreenConsent}
          isolatedEnvironment={isolatedEnvironment}
          setIsolatedEnvironment={setIsolatedEnvironment}
          maxSteps={maxSteps}
          setMaxSteps={setMaxSteps}
          onClose={() => setShowSetup(false)}
        />
      )}
    </section>
  );
}
