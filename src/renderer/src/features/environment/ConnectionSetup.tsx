import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Circle, KeyRound, RefreshCw, Shield, Trash2, Check, Lock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';

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

  const checks = [
    { label: 'Meta Model API', ok: info?.verified === true },
    { label: 'Desktop Capture & Input', ok: ready?.desktopSupported === true },
    { label: 'Emergency Stop Hotkey', ok: ready?.emergencyStopReady === true },
  ];

  const isConfigured = Boolean(info?.configured);
  const isStored = info?.source === 'stored' || info?.hasStored;

  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="setup-title" className="text-base font-bold text-slate-900">
              {info?.verified ? 'Meta API Connected' : isConfigured ? 'Verify Meta Connection' : 'Connect Meta API'}
            </h2>
            {isStored && (
              <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Lock className="h-2.5 w-2.5" />
                <span>Saved on Device</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {info?.verified
              ? isStored
                ? 'Your key is verified and encrypted in your local OS Keychain. No need to re-enter it tomorrow!'
                : 'Your API key is active for this session.'
              : isConfigured
              ? 'Key is ready. Run a connection test to activate.'
              : 'Enter your Meta model credential to enable autonomous computer operations.'}
          </p>
        </div>

        <Button
          type="button"
          onClick={runtime.refresh}
          disabled={runtime.pending}
          variant="secondary"
          size="sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Recheck Desktop</span>
        </Button>
      </div>

      {/* Main Form */}
      <form onSubmit={submit} aria-busy={runtime.pending} className="mt-5 space-y-4">
        {info && isConfigured && !changingKey ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                Active Model: <span className="font-mono text-slate-900">{info.model}</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Source: <span className="capitalize font-mono text-slate-700">{info.source}</span>
              </span>
            </div>

            <p role="status" className={`text-xs leading-relaxed ${info.verified ? 'text-emerald-700' : 'text-amber-700'}`}>
              {info.verified
                ? 'Meta API is verified and ready. You can close this dialog and execute tasks.'
                : 'Key is present. Test the connection to ensure valid credits and permissions.'}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
              {!info.verified && (
                <Button
                  type="submit"
                  disabled={!runtime.connected || runtime.pending}
                  variant="default"
                  size="sm"
                  className="font-bold"
                >
                  {runtime.pending ? 'Testing connection…' : 'Test Configured Key'}
                </Button>
              )}
              <Button
                type="button"
                disabled={runtime.pending}
                onClick={() => setChangingKey(true)}
                variant="secondary"
                size="sm"
              >
                Change Key
              </Button>
              {isStored && (
                <Button
                  type="button"
                  disabled={runtime.pending}
                  onClick={handleForget}
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  title="Remove saved encrypted key from this computer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Remove Saved Key</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="meta-key" className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <KeyRound className="h-3.5 w-3.5 text-slate-500" />
              Meta API Key
            </label>

            <div className="flex flex-wrap gap-2">
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
                className="min-w-0 basis-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:opacity-40 cursor-text caret-emerald-600"
              />

              <div className="flex items-center justify-between w-full pt-1">
                {/* Remember Key Checkbox Switch */}
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    rememberKey ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {rememberKey && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={rememberKey}
                    onChange={e => setRememberKey(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-[11px] font-medium text-slate-600">
                    Remember key securely on this device (OS Encrypted Keychain)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <Button
                      type="button"
                      disabled={runtime.pending}
                      onClick={() => { setKey(''); setChangingKey(false); }}
                      variant="secondary"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={!runtime.connected || runtime.pending || (!key.trim() && !isConfigured)}
                    variant="default"
                    size="sm"
                    className="font-bold"
                  >
                    {runtime.pending ? 'Testing Connection…' : key.trim() || !isConfigured ? 'Save & Connect' : 'Test Key'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <p id="meta-key-help" className="text-[11px] leading-relaxed text-slate-500">
          When saved, credentials are encrypted using your operating system's native hardware DPAPI (Windows) or Keychain (Linux/Mac). No plaintext keys are ever saved on disk or exposed to the web.
        </p>

        {runtime.setupError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {runtime.setupError}
          </p>
        )}
      </form>

      {/* System Readiness Checks */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="mb-2.5 text-xs font-bold text-slate-700">
          System Readiness Checks
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {checks.map(check => (
            <div key={check.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              {check.ok ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="font-medium text-slate-700">{check.label}</span>
              <span className="ml-auto text-[11px] font-mono text-slate-500">
                {check.ok ? 'Ready' : check.label === 'Meta Model API' ? isConfigured ? 'Untested' : 'Missing' : ready ? 'Check Fail' : 'Checking…'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {ready && !ready.ready && (
        <ul className="mt-4 list-disc space-y-1 border-t border-slate-200 pt-3 pl-4 text-xs leading-relaxed text-amber-700">
          {ready.issues.map(issue => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
