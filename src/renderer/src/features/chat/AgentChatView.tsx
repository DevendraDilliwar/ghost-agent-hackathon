import { useState } from 'react';
import { TaskComposer } from '../run/TaskComposer';
import { ResumeMissionList } from '../mission/ResumeMissionList';
import { RunControls } from '../run/RunControls';
import { isActiveTask } from '../run/task-presentation';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { ApprovalMode } from '../../../../shared/contracts/task';
import { ChatHeader } from './ChatHeader';
import { ChatThread } from './ChatThread';
import { SettingsOverlay } from './SettingsOverlay';
import { WorkspaceSidebar } from './WorkspaceSidebar';

export function AgentChatView({ runtime }: { runtime: TaskRuntimeView }) {
  const [showSetup, setShowSetup] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('full_access');
  const [screenConsent, setScreenConsent] = useState(true);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(true);
  // Mission budgets, adjustable in Settings. Long multi-phase deploys need more headroom than quick tasks.
  const [maxSteps, setMaxSteps] = useState(25);
  const [maxMinutes, setMaxMinutes] = useState(5);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const task = runtime.snapshot;
  const status = task?.status ?? 'idle';
  const active = isActiveTask(status);
  const modelReady = runtime.connection?.verified === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;
  // Settings always opens on live state, never on a stale mount-time snapshot.
  const openSetup = () => { runtime.refresh(); setShowSetup(true); };
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
        workspaceOpen={workspaceOpen}
        onToggleWorkspace={() => setWorkspaceOpen(open => !open)}
        onStop={runtime.stop}
        onOpenSetup={openSetup}
        onCompact={runtime.showControls}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <ChatThread runtime={runtime} onOpenSetup={openSetup} />

          <footer className="max-h-[60dvh] shrink-0 overflow-y-auto border-t border-slate-200 bg-white">
            <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-5">
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
              <div className="space-y-4">
                <ResumeMissionList
                  disabled={runtime.pending || !ready || !screenConsent || !isolatedEnvironment}
                  listMissions={runtime.listMissions}
                  onResume={mission => runtime.launch({
                    goal: mission.goal, maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment,
                    resume: { missionId: mission.missionId },
                  })}
                />
                <TaskComposer
                  key={task?.runId ?? 'new'}
                  initialGoal={task?.goal ?? ''}
                  approvalMode={approvalMode}
                  screenConsent={screenConsent}
                  isolatedEnvironment={isolatedEnvironment}
                  maxSteps={maxSteps}
                  maxMinutes={maxMinutes}
                  busy={runtime.pending}
                  connected={runtime.connected}
                  modelReady={modelReady}
                  ready={ready}
                  onOpenSetup={openSetup}
                  onLaunch={runtime.launch}
                />
              </div>
            )}
            </div>
          </footer>
        </main>

        <WorkspaceSidebar runtime={runtime} open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
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
          maxMinutes={maxMinutes}
          setMaxMinutes={setMaxMinutes}
          onClose={() => setShowSetup(false)}
        />
      )}
    </section>
  );
}
