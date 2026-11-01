import { useState } from 'react';
import type { FormEvent } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { TaskRuntimeView } from '../run/useTaskRuntime';

export function ConnectionSetup({ runtime }: { runtime: TaskRuntimeView }) {
  const [key, setKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [changingKey, setChangingKey] = useState(false);
  const info = runtime.connection;
  const ready = runtime.readiness;

  function submit(event: FormEvent) {
    event.preventDefault();
    const candidate = key.trim() || null;
    setKey('');
    void runtime.connectModel({ key: candidate, remember: rememberKey })
      .then(() => setChangingKey(false), () => setChangingKey(false));
  }

  function handleForget() {
    void runtime.connectModel({ forget: true }).then(() => setChangingKey(false));
  }

  const isConfigured = Boolean(info?.configured);
  const isStored = info?.source === 'stored' || info?.hasStored;
  const statusLabel = info?.verified ? 'Verified' : isConfigured ? 'Untested' : 'Missing';
  const statusDescription = info?.verified
    ? isStored
      ? 'Your key is verified and encrypted in your local OS Keychain. No need to re-enter it tomorrow!'
      : 'Your API key is active for this session.'
    : isConfigured
    ? 'Key is ready. Run a connection test to activate.'
    : 'Enter your Meta model credential to enable autonomous computer operations.';

  const checks = [
    { label: 'Meta Model API', ok: info?.verified === true },
    { label: 'Desktop Capture & Input', ok: ready?.desktopSupported === true },
    { label: 'Emergency Stop Hotkey', ok: ready?.emergencyStopReady === true },
  ];

  function checkStatus(label: string, ok: boolean): string {
    if (ok) return 'Ready';
    if (label === 'Meta Model API') return isConfigured ? 'Untested' : 'Missing';
    return ready ? 'Check Fail' : 'Checking…';
  }

  return (
    <section aria-label="Meta API connection">
      <div className="settings-row settings-section">
        <div>Meta Model API<span className="settings-row-description">{statusDescription}</span></div>
        <span className={info?.verified ? 'text-emerald-700 text-sm font-medium' : 'text-amber-700 text-sm font-medium'}>{statusLabel}</span>
      </div>

      {info && isConfigured && !changingKey ? (
        <>
          <div className="settings-row">
            <div>Active Model<span className="settings-row-description">Source: {info.source}{isStored ? ' · Saved on this device' : ''}</span></div>
            <span className="font-mono text-sm">{info.model}</span>
          </div>
          <p role="status" className={info.verified ? 'settings-status-ok' : 'settings-status-warn'}>
            {info.verified
              ? 'Meta API is verified and ready. You can close this dialog and execute tasks.'
              : 'Key is present. Test the connection to ensure valid credits and permissions.'}
          </p>
          <div className="settings-row">
            <div>Manage key</div>
            <div className="flex flex-wrap justify-end gap-2">
              {!info.verified && (
                <button type="button" disabled={!runtime.connected || runtime.pending} onClick={() => void runtime.connectModel({ key: null, remember: rememberKey })} className="settings-button">
                  {runtime.pending ? 'Testing connection…' : 'Test Configured Key'}
                </button>
              )}
              <button type="button" disabled={runtime.pending} onClick={() => setChangingKey(true)} className="settings-button">
                Change Key
              </button>
              {isStored && (
                <button type="button" disabled={runtime.pending} onClick={handleForget} className="settings-button settings-button-danger" title="Remove saved encrypted key from this computer">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Saved Key</span>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={submit} aria-busy={runtime.pending}>
          <div className="settings-row">
            <label htmlFor="meta-key">Meta API Key</label>
            <input
              id="meta-key"
              type="password"
              value={key}
              onChange={event => setKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="meta-key-help"
              autoFocus={!isConfigured}
              maxLength={4096}
              disabled={runtime.pending}
              placeholder={isConfigured ? 'Enter a replacement key' : 'Paste your Meta API key (sk-...)'}
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label htmlFor="meta-remember">Remember key on this device<span className="settings-row-description">Encrypted with your OS keychain. No plaintext keys are ever saved on disk.</span></label>
            <input className="settings-switch" id="meta-remember" type="checkbox" role="switch" checked={rememberKey} onChange={event => setRememberKey(event.target.checked)} />
          </div>
          <div className="settings-row">
            <div>Connect</div>
            <div className="flex flex-wrap justify-end gap-2">
              {isConfigured && (
                <button type="button" disabled={runtime.pending} onClick={() => { setKey(''); setChangingKey(false); }} className="settings-button">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={!runtime.connected || runtime.pending || (!key.trim() && !isConfigured)} className="settings-button">
                {runtime.pending ? 'Testing Connection…' : key.trim() || !isConfigured ? 'Save & Connect' : 'Test Key'}
              </button>
            </div>
          </div>
          <p id="meta-key-help" className="settings-help">
            When saved, credentials are encrypted using your operating system's native hardware DPAPI (Windows) or Keychain (Linux/Mac). No plaintext keys are ever saved on disk or exposed to the web.
          </p>
          {runtime.setupError && (
            <p role="alert" className="settings-error">
              {runtime.setupError}
            </p>
          )}
        </form>
      )}

      <div className="settings-row">
        <div>Desktop readiness<span className="settings-row-description">Re-run desktop permission checks.</span></div>
        <button type="button" onClick={runtime.refresh} disabled={runtime.pending} className="settings-button">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Recheck Desktop</span>
        </button>
      </div>

      {checks.map(check => (
        <div className="settings-row" key={check.label}>
          <div>{check.label}</div>
          <span className={check.ok ? 'text-emerald-700 text-sm font-medium' : 'text-amber-700 text-sm font-medium'}>{checkStatus(check.label, check.ok)}</span>
        </div>
      ))}

      {ready && !ready.ready && (
        <ul className="settings-issues">
          {ready.issues.map(issue => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
