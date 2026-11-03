import { useEffect, useRef, useState } from 'react';
import { Bell, Brush, Database, SlidersHorizontal, SquareDashedMousePointer, X } from 'lucide-react';
import { ConnectionSetup } from '../environment/ConnectionSetup';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { ApprovalMode } from '../../../../shared/contracts/task';
import type { TextSize, ThemeMode } from '../../lib/ui-preferences';

interface SettingsOverlayProps {
  runtime: TaskRuntimeView;
  approvalMode: ApprovalMode;
  setApprovalMode: (mode: ApprovalMode) => void;
  screenConsent: boolean;
  setScreenConsent: (value: boolean) => void;
  isolatedEnvironment: boolean;
  setIsolatedEnvironment: (value: boolean) => void;
  maxSteps: number;
  setMaxSteps: (value: number) => void;
  maxMinutes: number;
  setMaxMinutes: (value: number) => void;
  textSize: TextSize;
  setTextSize: (value: TextSize) => void;
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
  desktopNotifications: boolean;
  setDesktopNotifications: (value: boolean) => void;
  onClose: () => void;
}

type SettingsPage = 'Appearance' | 'Behavior' | 'Notifications' | 'Connection' | 'Data Controls';
const settingsGroups = [
  { label: 'General', items: [{ label: 'Appearance', icon: Brush }, { label: 'Behavior', icon: SquareDashedMousePointer }, { label: 'Notifications', icon: Bell }] },
  { label: 'Agent', items: [{ label: 'Connection', icon: SlidersHorizontal }] },
  { label: 'Data & Information', items: [{ label: 'Data Controls', icon: Database }] },
] as const;

export function SettingsOverlay({
  runtime,
  approvalMode, setApprovalMode,
  screenConsent, setScreenConsent,
  isolatedEnvironment, setIsolatedEnvironment,
  maxSteps, setMaxSteps,
  maxMinutes, setMaxMinutes,
  textSize, setTextSize,
  themeMode, setThemeMode,
  desktopNotifications, setDesktopNotifications,
  onClose,
}: SettingsOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<SettingsPage>('Behavior');

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Settings"
      aria-modal="true"
      className="settings-popup"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <button type="button" className="settings-popup-close chat-icon-button" onClick={onClose} aria-label="Close settings" title="Close settings"><X /></button>
      <nav className="settings-navigation" aria-label="Settings sections">
        {settingsGroups.map(group => <div className="settings-nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map(({ label, icon: Icon }) => <button key={label} type="button" autoFocus={label === 'Behavior'} aria-current={page === label ? 'page' : undefined} onClick={() => setPage(label)}><Icon /><span>{label}</span></button>)}
        </div>)}
      </nav>
      <div className="settings-main">
        <section className="settings-page" aria-labelledby="settings-page-title" key={page}>
          <h2 id="settings-page-title">{page}</h2>
          {page === 'Appearance' && <>
            <div className="settings-row settings-section"><label htmlFor="settings-theme">Theme<span className="settings-row-description">Switches the whole interface immediately.</span></label><select id="settings-theme" value={themeMode} onChange={event => setThemeMode(event.target.value as ThemeMode)}><option value="dark">Dark</option><option value="light">Light</option></select></div>
            <div className="settings-row"><label htmlFor="settings-text-size">Text size<span className="settings-row-description">Scales the chat interface up or down.</span></label><select id="settings-text-size" value={textSize} onChange={event => setTextSize(event.target.value as TextSize)}><option value="compact">Compact</option><option value="default">Default</option><option value="large">Large</option></select></div>
          </>}
          {page === 'Behavior' && <>
            <div className="settings-row settings-section"><label htmlFor="settings-approval">Approval mode<span className="settings-row-description">Choose how desktop actions are approved. Provider safety checks and every enabled host command always require review.</span></label><select id="settings-approval" value={approvalMode} onChange={event => setApprovalMode(event.target.value as ApprovalMode)}><option value="full_access">Full autonomous</option><option value="ask_approval">Step-by-step approval</option><option value="approve_for_me">Approve for me</option></select></div>
            <div className="settings-row"><label htmlFor="settings-steps">Max steps per run</label><select id="settings-steps" value={maxSteps} onChange={event => setMaxSteps(Number(event.target.value))}>{[25, 150, 500, 1000].map(value => <option key={value} value={value}>{value} steps</option>)}</select></div>
            <div className="settings-row"><label htmlFor="settings-minutes">Time limit per run</label><select id="settings-minutes" value={maxMinutes} onChange={event => setMaxMinutes(Number(event.target.value))}>{[10, 120, 240, 480].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></div>
            <p className="settings-help">These settings apply to your next desktop task.</p>
          </>}
          {page === 'Notifications' && <div className="settings-row settings-section"><label htmlFor="settings-notifications">Desktop notifications<span className="settings-row-description">Show an OS popup when a task needs approval, hands off to you, or finishes.</span></label><input className="settings-switch" id="settings-notifications" type="checkbox" role="switch" checked={desktopNotifications} onChange={event => setDesktopNotifications(event.target.checked)} /></div>}
          <div hidden={page !== 'Connection'} className="settings-connection"><ConnectionSetup runtime={runtime} /></div>
          {page === 'Data Controls' && <>
            <div className="settings-row settings-section"><label htmlFor="settings-screen-consent">Desktop screenshots<span className="settings-row-description">Allow screenshots to be sent to Meta’s API for AI vision processing.</span></label><input className="settings-switch" id="settings-screen-consent" type="checkbox" role="switch" checked={screenConsent} onChange={event => setScreenConsent(event.target.checked)} /></div>
            <div className="settings-row settings-section"><label htmlFor="settings-isolated">Test desktop environment<span className="settings-row-description">Confirm a disposable single-display Ubuntu X11 session. This checkbox does not isolate your OS.</span></label><input className="settings-switch" id="settings-isolated" type="checkbox" role="switch" checked={isolatedEnvironment} onChange={event => setIsolatedEnvironment(event.target.checked)} /></div>
            <div className="settings-row"><span>Emergency stop</span><kbd className="settings-muted">{runtime.readiness?.emergencyStopShortcut ?? 'Unavailable'}</kbd></div>
            <p className="settings-help">You can pause or take control at any time. The agent never resumes on its own. Keep passwords and secrets out of the target app.</p>
            <p className="settings-help">Host shell: {runtime.readiness?.capabilities?.hostShell ? 'enabled; reviewed commands can access your files and network' : 'disabled'}. Accessibility: {runtime.readiness?.capabilities?.accessibility ? 'enabled; reads UI labels' : 'disabled'}.</p>
            <p className="settings-help">Goals and your text replies stay in local chat history until you delete the chat. Agent text and terminal output are omitted by default. Mission content retention: {runtime.readiness?.capabilities?.retainTaskContent ? 'enabled; task values, photos, and learned context may be stored for recovery' : 'disabled; photos and mission context stay in memory, and restart resume is unavailable'}. Existing saved data is preserved.</p>
            <p className="settings-help">Local storage: {runtime.readiness?.storageHealthy === false ? 'could not save; recovery may be unavailable' : 'no reported write failures'}.</p>
          </>}
        </section>
      </div>
    </dialog>
  );
}
