import { useEffect, useState } from 'react';
import { BookOpen, Bot, Hexagon, LayoutGrid, MoreVertical, PanelLeftClose, Search, Settings, Square, SquarePen, X } from 'lucide-react';
import { TaskComposer } from '../run/TaskComposer';
import { ResumeMissionList } from '../mission/ResumeMissionList';
import { RunControls } from '../run/RunControls';
import { isActiveTask, toViewSnapshot } from '../run/task-presentation';
import { TaskHistoryList } from '../run/TaskHistoryList';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import { useTaskNotifier } from '../run/useTaskNotifier';
import type { ApprovalMode, RunConfiguration } from '../../../../shared/contracts/task';
import type { RunRecord, RunSummary } from '../../../../shared/contracts/history';
import type { TextSize, ThemeMode } from '../../lib/ui-preferences';
import { loadDesktopNotifications, loadTextSize, loadThemeMode, saveDesktopNotifications, saveTextSize, saveThemeMode } from '../../lib/ui-preferences';
import { ChatThread } from './ChatThread';
import { SettingsOverlay } from './SettingsOverlay';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { buildRetryNote } from '../mission/MissionGraph';

export function AgentChatView({ runtime }: { runtime: TaskRuntimeView }) {
  const [showSetup, setShowSetup] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 760px)').matches);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const [hiddenRunId, setHiddenRunId] = useState<string | null>(null);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('full_access');
  const [screenConsent, setScreenConsent] = useState(true);
  const [isolatedEnvironment, setIsolatedEnvironment] = useState(true);
  const [maxSteps, setMaxSteps] = useState(25);
  const [maxMinutes, setMaxMinutes] = useState(5);
  const [textSize, setTextSize] = useState(loadTextSize);
  const [themeMode, setThemeMode] = useState(loadThemeMode);
  const [desktopNotifications, setDesktopNotifications] = useState(loadDesktopNotifications);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<RunRecord | null>(null);
  useTaskNotifier(runtime.snapshot, desktopNotifications);
  const task = runtime.snapshot;
  const status = task?.status ?? 'idle';
  const active = isActiveTask(status);
  const modelReady = runtime.connection?.verified === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;
  const freshChat = Boolean(hiddenRunId && task?.runId === hiddenRunId && !active);
  const viewing = viewingId !== null && viewingId !== task?.runId;
  const displayRuntime = viewing
    ? { ...runtime, snapshot: viewRecord && viewRecord.runId === viewingId ? toViewSnapshot(viewRecord) : null }
    : freshChat ? { ...runtime, snapshot: null } : runtime;
  const liveRunId = task?.runId;
  const liveStatus = task?.status;
  const listRuns = runtime.listRuns;
  useEffect(() => {
    // Re-fetch when the live run starts, changes phase, or ends so a
    // finished task appears in history without a manual refresh.
    const token = `${liveRunId ?? ''}:${liveStatus ?? ''}`;
    void token;
    let cancelled = false;
    void listRuns().then(
      found => { if (!cancelled) setRuns(found); },
      () => { if (!cancelled) setRuns([]); },
    );
    return () => { cancelled = true; };
  }, [listRuns, liveRunId, liveStatus]);
  const summaries = task?.runId && !runs.some(run => run.runId === task.runId)
    ? [{ runId: task.runId, goal: task.goal, status: task.status, createdAt: 0, updatedAt: 0, missionId: null, resumable: false }, ...runs]
    : runs;
  const openSetup = () => { runtime.refresh(); setShowSetup(true); };
  const launch = (configuration: RunConfiguration) => { setHiddenRunId(null); setViewingId(null); setViewRecord(null); setWorkspaceOpen(true); runtime.launch(configuration); };
  const changeTextSize = (value: TextSize) => { setTextSize(value); saveTextSize(value); };
  const changeThemeMode = (value: ThemeMode) => { setThemeMode(value); saveThemeMode(value); };
  const changeDesktopNotifications = (value: boolean) => { setDesktopNotifications(value); saveDesktopNotifications(value); };
  const closeMobileSidebar = () => { if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); };
  const selectRun = (runId: string | null) => {
    setShowMissions(false);
    if (runId === null || runId === task?.runId) {
      setViewingId(null);
      setViewRecord(null);
      setHiddenRunId(null);
    } else {
      setViewingId(runId);
      setViewRecord(null);
      void runtime.getRun(runId).then(record => setViewRecord(record));
    }
    closeMobileSidebar();
  };
  const resumeViewed = () => {
    if (!viewRecord?.missionId) return;
    launch({ goal: viewRecord.goal, maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment, resume: { missionId: viewRecord.missionId } });
  };
  const retryPhase = (phaseId: string) => {
    const mission = runtime.snapshot?.mission;
    const phase = mission?.phases.find(item => item.phaseId === phaseId);
    if (!mission || !phase || phase.status !== 'failed') return;
    launch({ goal: mission.goal, maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment,
      resume: { missionId: mission.missionId, note: buildRetryNote(phase) } });
  };
  const newChat = () => {
    if (active || runtime.pending) return;
    setHiddenRunId(task?.runId ?? null);
    setViewingId(null);
    setViewRecord(null);
    setDraftVersion(version => version + 1);
    setShowMissions(false);
    closeMobileSidebar();
  };

  return (
    <div className={`chat-dashboard reference-dashboard ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`} data-text-size={textSize} data-theme={themeMode}>
      {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className="chat-navigation" aria-label="Main navigation">
        <div className="navigation-brand">
          <button type="button" className="navigation-logo" aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} title={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(value => !value)}><Bot size={26} aria-hidden="true" /></button>
          <span className="brand-name">Ghost Agent</span>
          <button type="button" className="chat-icon-button" aria-label="Search current conversation" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}><Search /></button>
          <button type="button" className="chat-icon-button" aria-label="Collapse navigation" onClick={() => setSidebarOpen(false)}><PanelLeftClose /></button>
        </div>
        {searchOpen && sidebarOpen && <div className="navigation-search"><Search size={15} /><input autoFocus aria-label="Search current conversation" placeholder="Search current chat" value={search} onChange={event => setSearch(event.target.value)} /></div>}
        <nav className="navigation-links" aria-label="Workspace navigation">
          <button type="button" aria-label="New chat" title="New chat" onClick={newChat} disabled={active || runtime.pending}><SquarePen /><span>New chat</span></button>
          <button type="button" className="navigation-rail-only" aria-label="Search conversations" title="Search conversations" onClick={() => { setSidebarOpen(true); setSearchOpen(true); }}><Search /></button>
          <button type="button" aria-label="Library" title="Library" aria-pressed={showMissions} onClick={() => { setShowMissions(value => !value); closeMobileSidebar(); }}><LayoutGrid /><span>Library</span></button>
          <button type="button" className="navigation-settings" aria-label="Settings" title="Settings" disabled={active} onClick={openSetup}><Hexagon /><span>Settings</span></button>
        </nav>
        <TaskHistoryList runs={summaries} activeRunId={task?.runId ?? null} selectedRunId={viewingId} search={search} onSelect={selectRun} />
        <div className="navigation-account">
          <span className="account-avatar reference-avatar" role="img" aria-label="Local session">G</span>
          <div><span>Local session</span></div>
          <button type="button" className="chat-icon-button" disabled={active} onClick={openSetup} aria-label="Open settings" title="Open settings"><Settings /></button>
        </div>
      </aside>

      <section className="chat-main" aria-label="Ghost Agent chat">
        <header className="chat-topbar">
          <div className="chat-topbar-left">{showMissions && <span className="chat-topbar-title">Library</span>}</div>
          <div className="chat-topbar-actions">
            {active && <button type="button" className="chat-stop" onClick={runtime.stop}><Square size={13} />Stop</button>}
            <button type="button" className="chat-icon-button" aria-label="More options" title="More options" aria-expanded={moreOpen} onClick={() => setMoreOpen(value => !value)}><MoreVertical /></button>
          </div>
          {moreOpen && <div className="reference-main-menu"><button type="button" onClick={() => { setWorkspaceOpen(value => !value); setMoreOpen(false); }}>Live workspace</button><button type="button" disabled={!runtime.connected} onClick={() => { runtime.showControls(); setMoreOpen(false); }}>Floating controls</button><button type="button" disabled={active} onClick={() => { openSetup(); setMoreOpen(false); }}>Settings</button></div>}
        </header>
        {viewing && viewRecord && (
          <div className="viewing-banner" role="status">
            <span>Viewing past task · {viewRecord.goal || 'Untitled task'}</span>
            {viewRecord.resumable && viewRecord.missionId && (
              <button type="button" disabled={active || runtime.pending || !ready || !screenConsent || !isolatedEnvironment} onClick={resumeViewed}>Resume</button>
            )}
            <button type="button" onClick={() => selectRun(null)}>Back</button>
          </div>
        )}

        {showMissions ? (
          <div className="mission-library">
            <div className="library-heading"><div><BookOpen size={26} /><h1>Your mission library</h1><p>Pick up an interrupted desktop task where you left off.</p></div><button type="button" className="chat-icon-button" aria-label="Close library" onClick={() => setShowMissions(false)}><X /></button></div>
            <p className="library-notice">{runtime.connected ? 'Saved missions with unfinished phases appear below.' : 'Open the desktop app to access your saved missions.'}</p>
            <ResumeMissionList disabled={active || runtime.pending || !ready || !screenConsent || !isolatedEnvironment} listMissions={runtime.listMissions} onResume={mission => { setShowMissions(false); launch({ goal: mission.goal, maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment, resume: { missionId: mission.missionId } }); }} />
          </div>
        ) : <ChatThread runtime={displayRuntime} onOpenSetup={openSetup} />}

        <footer className="chat-composer-footer">
          <div className="chat-composer-inner">
            {active ? <RunControls status={status} disabled={runtime.pending} emergencyStopShortcut={runtime.readiness?.emergencyStopShortcut ?? null} onPause={runtime.pause} onResume={runtime.resume} onTakeOver={runtime.takeOver} onStop={runtime.stop} /> : (
              <TaskComposer displayName="Ghost Agent" key={`${task?.runId ?? 'new'}-${draftVersion}`} initialGoal="" approvalMode={approvalMode} screenConsent={screenConsent} isolatedEnvironment={isolatedEnvironment} maxSteps={maxSteps} maxMinutes={maxMinutes} busy={runtime.pending} connected={runtime.connected} modelReady={modelReady} ready={ready} onOpenSetup={openSetup} onLaunch={launch} onBudgetChange={(steps, minutes) => { setMaxSteps(steps); setMaxMinutes(minutes); }} />
            )}
          </div>
        </footer>
      </section>
      <WorkspaceSidebar runtime={runtime} open={workspaceOpen} onClose={() => setWorkspaceOpen(false)}
        onRetryPhase={active || runtime.pending || !ready || !screenConsent || !isolatedEnvironment ? undefined : retryPhase} />
      {showSetup && !active && <SettingsOverlay runtime={runtime} approvalMode={approvalMode} setApprovalMode={setApprovalMode} screenConsent={screenConsent} setScreenConsent={setScreenConsent} isolatedEnvironment={isolatedEnvironment} setIsolatedEnvironment={setIsolatedEnvironment} maxSteps={maxSteps} setMaxSteps={setMaxSteps} maxMinutes={maxMinutes} setMaxMinutes={setMaxMinutes} textSize={textSize} setTextSize={changeTextSize} themeMode={themeMode} setThemeMode={changeThemeMode} desktopNotifications={desktopNotifications} setDesktopNotifications={changeDesktopNotifications} onClose={() => setShowSetup(false)} />}
    </div>
  );
}
