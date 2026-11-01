import { useState } from 'react';
import { BookOpen, Clock, Filter, GraduationCap, Hexagon, Images, LayoutGrid, MoreVertical, PanelLeftClose, Plus, Search, Settings, Square, SquarePen, X } from 'lucide-react';
import { TaskComposer } from '../run/TaskComposer';
import { ResumeMissionList } from '../mission/ResumeMissionList';
import { RunControls } from '../run/RunControls';
import { isActiveTask } from '../run/task-presentation';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { ApprovalMode, RunConfiguration } from '../../../../shared/contracts/task';
import { ChatThread } from './ChatThread';
import { SettingsOverlay } from './SettingsOverlay';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { ReferenceConversation } from './ReferenceConversation';

const referenceNotebooks = ['Microprocessors & Interfaces Exam', 'Formal Languages & Automata Theory', 'Computer Network Exam (2021)'];
const referenceChats = ['NoMCP Agent Build', 'Understanding Framer Platform', 'Biodata Text Correction', 'Biodata Text Correction', 'बायोडाटा सुधार निर्देश', 'Home Interior Services', 'Hindi Text Corrections', 'Biodata Text Corrections', 'Biodata Text Corrections', 'Anganwadi Worker Details', 'Google Colab VRAM Reality'];

export function AgentChatView({ runtime }: { runtime: TaskRuntimeView }) {
  const [showSetup, setShowSetup] = useState(false);
  const [referenceVisible, setReferenceVisible] = useState(true);
  const [infoPanel, setInfoPanel] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notebookName, setNotebookName] = useState('');
  const [notebooks, setNotebooks] = useState(referenceNotebooks);
  const [onlyCurrent, setOnlyCurrent] = useState(false);
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
  const task = runtime.snapshot;
  const status = task?.status ?? 'idle';
  const active = isActiveTask(status);
  const modelReady = runtime.connection?.verified === true;
  const ready = runtime.connected && modelReady && runtime.readiness?.ready === true;
  const freshChat = Boolean(hiddenRunId && task?.runId === hiddenRunId && !active);
  const displayRuntime = freshChat ? { ...runtime, snapshot: null } : runtime;
  const openSetup = () => { runtime.refresh(); setShowSetup(true); };
  const launch = (configuration: RunConfiguration) => { setHiddenRunId(null); runtime.launch(configuration); };
  const closeMobileSidebar = () => { if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); };
  const newChat = () => {
    if (active || runtime.pending) return;
    setHiddenRunId(task?.runId ?? null);
    setDraftVersion(version => version + 1);
    setShowMissions(false);
    setReferenceVisible(false);
    closeMobileSidebar();
  };

  return (
    <div className={`chat-dashboard reference-dashboard ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className="chat-navigation" aria-label="Main navigation">
        <div className="navigation-brand">
          <button type="button" className="navigation-logo" aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} title={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(value => !value)}><svg className="reference-gemini-mark" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="gemini-mark-gradient" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#43b980" /><stop offset=".28" stopColor="#8ab4f8" /><stop offset=".6" stopColor="#478df4" /><stop offset=".83" stopColor="#d775b5" /><stop offset="1" stopColor="#f4c65e" /></linearGradient></defs><path fill="url(#gemini-mark-gradient)" d="M14 0C16 8 20 12 28 14C20 16 16 20 14 28C12 20 8 16 0 14C8 12 12 8 14 0Z" /></svg></button>
          <span className="brand-name">Gemini</span>
          <button type="button" className="chat-icon-button" aria-label="Search current conversation" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}><Search /></button>
          <button type="button" className="chat-icon-button" aria-label="Collapse navigation" onClick={() => setSidebarOpen(false)}><PanelLeftClose /></button>
        </div>
        {searchOpen && sidebarOpen && <div className="navigation-search"><Search size={15} /><input autoFocus aria-label="Search current conversation" placeholder="Search current chat" value={search} onChange={event => setSearch(event.target.value)} /></div>}
        <nav className="navigation-links" aria-label="Workspace navigation">
          <button type="button" aria-label="New chat" title="New chat" onClick={newChat} disabled={active || runtime.pending}><SquarePen /><span>New chat</span></button>
          <button type="button" className="navigation-rail-only" aria-label="Search conversations" title="Search conversations" onClick={() => { setSidebarOpen(true); setSearchOpen(true); }}><Search /></button>
          <button type="button" aria-label="Library" title="Library" aria-pressed={showMissions} onClick={() => { setShowMissions(value => !value); closeMobileSidebar(); }}><LayoutGrid /><span>Library</span></button>
          <button type="button" aria-label="Images" title="Images" onClick={() => { setReferenceVisible(true); setShowMissions(false); closeMobileSidebar(); }}><Images /><span>Images</span></button>
          <button type="button" aria-label="Scheduled" title="Scheduled" onClick={() => setInfoPanel('Scheduled')}><Clock /><span>Scheduled</span></button>
          <button type="button" aria-label="Students" title="Students" onClick={() => setInfoPanel('Students')}><GraduationCap /><span>Students</span></button>
          <button type="button" className="navigation-customise" aria-label="Customise" title="Customise" disabled={active} onClick={openSetup}><Hexagon /><span>Customise</span></button>
        </nav>
        <section className="reference-notebooks" aria-label="Notebooks">
          <h2>Notebooks</h2>
          <button type="button" onClick={() => setInfoPanel('New notebook')}><Plus /><span>New notebook</span></button>
          {notebooks.map((notebook, index) => <button type="button" key={`${notebook}-${index}`} title={notebook} onClick={() => setInfoPanel(notebook)}><BookOpen /><span>{notebook}</span></button>)}
        </section>
        <div className="navigation-history">
          <div className="navigation-section-label"><span>{onlyCurrent ? 'Current' : 'All'}</span><button type="button" className="chat-icon-button" aria-label="Filter conversations" title="Show current conversation only" aria-pressed={onlyCurrent} onClick={() => setOnlyCurrent(value => !value)}><Filter /></button></div>
          {task?.runId && (!search || task.goal.toLowerCase().includes(search.toLowerCase())) && <button type="button" className={`history-item ${!freshChat ? 'selected' : ''}`} title={task.goal} onClick={() => { setHiddenRunId(null); setShowMissions(false); closeMobileSidebar(); }}>{task.goal}</button>}
          {referenceChats.map((title, index) => ({ title, index })).filter(({ title, index }) => (!onlyCurrent || index === 0) && title.toLowerCase().includes(search.toLowerCase())).map(({ title, index }) => <button type="button" className={`history-item ${index === 0 && referenceVisible && !task?.runId ? 'selected' : ''}`} key={`${title}-${index}`} title={title} onClick={() => { if (index === 0) { setReferenceVisible(true); setShowMissions(false); setHiddenRunId(task?.runId ?? null); closeMobileSidebar(); } else setInfoPanel(title); }}>{title}</button>)}
        </div>
        <div className="navigation-account">
          <span className="account-avatar reference-avatar" role="img" aria-label="Devendra Dilliwar">D</span>
          <div><span>Devendra Dilliwar</span></div>
          <button type="button" className="chat-icon-button" disabled={active} onClick={openSetup} aria-label="Open settings" title="Open settings"><Settings /></button>
        </div>
      </aside>

      <section className="chat-main" aria-label="NoMCP chat">
        <header className="chat-topbar">
          <div className="chat-topbar-left">{showMissions && <span className="chat-topbar-title">Library</span>}</div>
          <div className="chat-topbar-actions">
            {active && <button type="button" className="chat-stop" onClick={runtime.stop}><Square size={13} />Stop</button>}
            <button type="button" className="workspace-toggle reference-upgrade" onClick={() => setInfoPanel('Upgrade')}><span aria-hidden="true">✦</span><span>Upgrade</span></button>
            <button type="button" className="chat-icon-button" aria-label="More options" title="More options" aria-expanded={moreOpen} onClick={() => setMoreOpen(value => !value)}><MoreVertical /></button>
          </div>
          {moreOpen && <div className="reference-main-menu"><button type="button" onClick={() => { setWorkspaceOpen(value => !value); setMoreOpen(false); }}>Live workspace</button><button type="button" disabled={!runtime.connected} onClick={() => { runtime.showControls(); setMoreOpen(false); }}>Floating controls</button><button type="button" disabled={active} onClick={() => { openSetup(); setMoreOpen(false); }}>Settings</button></div>}
        </header>

        {showMissions ? (
          <div className="mission-library">
            <div className="library-heading"><div><BookOpen size={26} /><h1>Your mission library</h1><p>Pick up an interrupted desktop task where you left off.</p></div><button type="button" className="chat-icon-button" aria-label="Close library" onClick={() => setShowMissions(false)}><X /></button></div>
            <p className="library-notice">{runtime.connected ? 'Saved missions with unfinished phases appear below.' : 'Open the desktop app to access your saved missions.'}</p>
            <ResumeMissionList disabled={active || runtime.pending || !ready || !screenConsent || !isolatedEnvironment} listMissions={runtime.listMissions} onResume={mission => { setShowMissions(false); launch({ goal: mission.goal, maxSteps, maxMinutes, approvalMode, screenConsent, isolatedEnvironment, resume: { missionId: mission.missionId } }); }} />
          </div>
        ) : referenceVisible && !displayRuntime.snapshot?.runId ? <ReferenceConversation /> : <ChatThread runtime={displayRuntime} onOpenSetup={openSetup} />}

        <footer className="chat-composer-footer">
          <div className="chat-composer-inner">
            {active ? <RunControls status={status} disabled={runtime.pending} emergencyStopShortcut={runtime.readiness?.emergencyStopShortcut ?? null} onPause={runtime.pause} onResume={runtime.resume} onTakeOver={runtime.takeOver} onStop={runtime.stop} /> : (
              <TaskComposer displayName="Gemini" key={`${task?.runId ?? 'new'}-${draftVersion}`} initialGoal="" approvalMode={approvalMode} screenConsent={screenConsent} isolatedEnvironment={isolatedEnvironment} maxSteps={maxSteps} maxMinutes={maxMinutes} busy={runtime.pending} connected={runtime.connected} modelReady={modelReady} ready={ready} onOpenSetup={openSetup} onLaunch={launch} />
            )}
            <p className="composer-disclaimer">Gemini is AI and can make mistakes.</p>
          </div>
        </footer>
      </section>
      {infoPanel && <div className="reference-dialog-backdrop" onClick={() => setInfoPanel(null)}><section role="dialog" aria-modal="true" aria-label={infoPanel} className="reference-dialog" onClick={event => event.stopPropagation()}><header><h2>{infoPanel}</h2><button type="button" className="chat-icon-button" aria-label="Close dialog" onClick={() => setInfoPanel(null)}><X /></button></header>{infoPanel === 'New notebook' ? <form onSubmit={event => { event.preventDefault(); if (notebookName.trim()) { setNotebooks(items => [...items, notebookName.trim()]); setNotebookName(''); setInfoPanel(null); } }}><label htmlFor="notebook-name">Notebook name</label><input id="notebook-name" autoFocus required maxLength={100} value={notebookName} onChange={event => setNotebookName(event.target.value)} /><button type="submit" className="workspace-toggle">Create notebook</button></form> : <p>{infoPanel === 'Upgrade' ? 'This is a local UI reproduction. Google subscriptions and billing are not connected.' : infoPanel === 'Scheduled' ? 'No scheduled tasks. Scheduling is not connected in this UI reproduction.' : infoPanel === 'Students' ? 'Student plans and verification are not connected in this UI reproduction.' : 'This entry reproduces the supplied screenshot. Its original conversation or notebook content is not available here.'}</p>}</section></div>}
      <WorkspaceSidebar runtime={runtime} open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
      {showSetup && !active && <SettingsOverlay runtime={runtime} approvalMode={approvalMode} setApprovalMode={setApprovalMode} screenConsent={screenConsent} setScreenConsent={setScreenConsent} isolatedEnvironment={isolatedEnvironment} setIsolatedEnvironment={setIsolatedEnvironment} maxSteps={maxSteps} setMaxSteps={setMaxSteps} maxMinutes={maxMinutes} setMaxMinutes={setMaxMinutes} onClose={() => setShowSetup(false)} />}
    </div>
  );
}
