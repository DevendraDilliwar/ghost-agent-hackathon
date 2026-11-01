import { useEffect, useRef, useState } from 'react';
import { Bell, Brush, Database, Languages, SlidersHorizontal, SquareDashedMousePointer, UserRound, X } from 'lucide-react';
import { ConnectionSetup } from '../environment/ConnectionSetup';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { ApprovalMode } from '../../../../shared/contracts/task';

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
  onClose: () => void;
}

type SettingsPage = 'Account' | 'Appearance' | 'Behavior' | 'Notifications' | 'Customize' | 'Data Controls';
const settingsGroups = [
  { label: 'General', items: [{ label: 'Account', icon: UserRound }, { label: 'Appearance', icon: Brush }, { label: 'Behavior', icon: SquareDashedMousePointer }, { label: 'Notifications', icon: Bell }] },
  { label: 'Grok', items: [{ label: 'Customize', icon: SlidersHorizontal }] },
  { label: 'Data & Information', items: [{ label: 'Data Controls', icon: Database }] },
] as const;

export function SettingsOverlay({
  runtime,
  approvalMode, setApprovalMode,
  screenConsent, setScreenConsent,
  isolatedEnvironment, setIsolatedEnvironment,
  maxSteps, setMaxSteps,
  maxMinutes, setMaxMinutes,
  onClose,
}: SettingsOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<SettingsPage>('Account');
  const [notice, setNotice] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({ name: 'Devendra Dilliwar', email: 'devendradilliwar30@gmail.com', birthYear: '2000' });
  const [draftProfile, setDraftProfile] = useState(profile);
  const upgrade = () => setNotice('This is a local settings preview. Subscriptions and billing are not connected.');

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
          {group.items.map(({ label, icon: Icon }) => <button key={label} type="button" autoFocus={label === 'Account'} aria-current={page === label ? 'page' : undefined} onClick={() => { setPage(label); setNotice(''); }}><Icon /><span>{label}</span></button>)}
        </div>)}
      </nav>
      <div className="settings-main">
        <section className="settings-page" aria-labelledby="settings-page-title" key={page}>
          <h2 id="settings-page-title">{page}</h2>
          {page === 'Account' && <>
            <div className="settings-profile settings-section">
              <span className="settings-profile-avatar" aria-hidden="true">{profile.name.trim().charAt(0) || 'D'}</span>
              <div className="settings-profile-text"><p>{profile.name}</p><span>{profile.email}</span></div>
              <button type="button" className="settings-outline-button" onClick={() => { setDraftProfile(profile); setEditingProfile(value => !value); }}>{editingProfile ? 'Cancel' : 'Manage'}</button>
            </div>
            {editingProfile && <form className="settings-profile-editor" onSubmit={event => { event.preventDefault(); setProfile(draftProfile); setEditingProfile(false); setNotice('Preview profile updated for this open dialog. No external account was changed.'); }}>
              <p>Edit the reference profile for this preview.</p>
              <label>Name<input required value={draftProfile.name} maxLength={80} onChange={event => setDraftProfile({ ...draftProfile, name: event.target.value })} /></label>
              <label>Email<input required type="email" value={draftProfile.email} maxLength={254} onChange={event => setDraftProfile({ ...draftProfile, email: event.target.value })} /></label>
              <label>Birth year<input required type="number" min={1900} max={new Date().getFullYear()} value={draftProfile.birthYear} onChange={event => setDraftProfile({ ...draftProfile, birthYear: event.target.value })} /></label>
              <button type="submit" className="settings-outline-button">Save preview</button>
            </form>}
            <div className="settings-section settings-subscription-section">
              <div className="settings-row"><div>Subscription <span className="settings-muted">Free</span></div><button type="button" className="settings-outline-button" onClick={upgrade}>Upgrade</button></div>
              <div className="settings-row"><div>𝕏 Account</div><button type="button" className="settings-outline-button" onClick={() => setNotice('X account linking is not connected in this local preview.')}>Connect</button></div>
            </div>
            <div className="settings-account-details">
              <div className="settings-row"><div className="settings-label-with-icon">Language <Languages /></div><button type="button" className="settings-outline-button" onClick={() => setNotice('The interface currently supports English. Language switching is not connected.')}>Change</button></div>
              <div className="settings-row"><div>Birth Year <span className="settings-muted">{profile.birthYear}</span></div></div>
            </div>
          </>}
          {page === 'Appearance' && <>
            <div className="settings-row settings-section"><div>Theme<span className="settings-row-description">The dark appearance used throughout the chat.</span></div><span className="settings-choice"><span className="settings-theme-swatch" />Dark</span></div>
            <div className="settings-row"><span>Font</span><span className="settings-muted">Google Sans</span></div>
            <div className="settings-row"><span>Text size</span><span className="settings-muted">Default</span></div>
          </>}
          {page === 'Behavior' && <>
            <div className="settings-row settings-section"><label htmlFor="settings-approval">Approval mode<span className="settings-row-description">Choose how desktop actions are approved.</span></label><select id="settings-approval" value={approvalMode} onChange={event => setApprovalMode(event.target.value as ApprovalMode)}><option value="full_access">Full autonomous</option><option value="ask_approval">Step-by-step approval</option><option value="approve_for_me">Approve for me</option></select></div>
            <div className="settings-row"><label htmlFor="settings-steps">Max steps per run</label><select id="settings-steps" value={maxSteps} onChange={event => setMaxSteps(Number(event.target.value))}>{[10, 25, 50, 100].map(value => <option key={value} value={value}>{value} steps</option>)}</select></div>
            <div className="settings-row"><label htmlFor="settings-minutes">Time limit per run</label><select id="settings-minutes" value={maxMinutes} onChange={event => setMaxMinutes(Number(event.target.value))}>{[5, 15, 30, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></div>
            <p className="settings-help">These settings apply to your next desktop task.</p>
          </>}
          {page === 'Notifications' && <div className="settings-row settings-section"><div>Desktop notifications<span className="settings-row-description">Task progress is shown in the conversation and floating controls.</span></div><span className="settings-muted">Not connected</span></div>}
          <div hidden={page !== 'Customize'} className="settings-connection"><ConnectionSetup runtime={runtime} /></div>
          {page === 'Data Controls' && <>
            <div className="settings-row settings-section"><label htmlFor="settings-screen-consent">Desktop screenshots<span className="settings-row-description">Allow screenshots to be sent to Meta’s API for AI vision processing.</span></label><input className="settings-switch" id="settings-screen-consent" type="checkbox" role="switch" checked={screenConsent} onChange={event => setScreenConsent(event.target.checked)} /></div>
            <div className="settings-row settings-section"><label htmlFor="settings-isolated">Test desktop environment<span className="settings-row-description">Confirm that tasks run on your verified test desktop.</span></label><input className="settings-switch" id="settings-isolated" type="checkbox" role="switch" checked={isolatedEnvironment} onChange={event => setIsolatedEnvironment(event.target.checked)} /></div>
            <div className="settings-row"><span>Emergency stop</span><kbd className="settings-muted">{runtime.readiness?.emergencyStopShortcut ?? 'Unavailable'}</kbd></div>
            <p className="settings-help">You can pause or take control at any time. The agent never resumes on its own. Keep passwords and secrets out of the target app.</p>
          </>}
          {notice && <div className="settings-notice" role="status"><p>{notice}</p><button type="button" className="chat-icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X /></button></div>}
        </section>
        <footer className="settings-premium-strip"><div><strong>Premium</strong><span>Fewer rate limits, more capabilities</span></div><button type="button" onClick={upgrade}>Upgrade</button></footer>
      </div>
    </dialog>
  );
}
