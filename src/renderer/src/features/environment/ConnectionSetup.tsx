import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Circle, KeyRound, RefreshCw } from 'lucide-react';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';

export function ConnectionSetup({ runtime }: { runtime: TaskRuntimeView }) {
  const [key, setKey] = useState('');
  const [changingKey, setChangingKey] = useState(false);
  const info = runtime.connection;
  const ready = runtime.readiness;
  function submit(event: FormEvent) {
    event.preventDefault();
    const candidate = key.trim() || null;
    setKey('');
    void runtime.connectModel(candidate).then(() => setChangingKey(false), () => setChangingKey(false));
  }
  const checks = [
    { label: 'Meta text API', ok: info?.verified === true },
    { label: 'Screen & input', ok: ready?.desktopSupported === true },
    { label: 'Emergency Stop', ok: ready?.emergencyStopReady === true },
  ];
  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="setup-title" className="text-base font-semibold">{info?.verified ? 'Meta connected' : info?.configured ? 'Verify Meta connection' : 'Connect Meta'}</h2>
          <p className="mt-1 text-xs text-slate-400">{info?.verified ? 'Your API key is ready for tasks in this app session.' : info?.configured ? 'Your key is already configured. Test it without entering it again.' : 'Enter your API key to get started.'}</p></div>
        <button type="button" onClick={runtime.refresh} disabled={runtime.pending} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">
          <RefreshCw className="h-3.5 w-3.5" />Recheck desktop
        </button>
      </div>
      <form onSubmit={submit} aria-busy={runtime.pending} className="mt-5 space-y-3">
        {info?.configured && !changingKey ? <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p role="status" className={'text-xs leading-relaxed ' + (info.verified ? 'text-emerald-300' : 'text-amber-200')}>
            {info.verified ? 'Meta text API is connected. You do not need to enter or test the key for each task.' : 'Your key is available. Run a connection test to verify it.'} · {info.model}
          </p>
          <div className="flex flex-wrap gap-2">
            {!info.verified && <button type="submit" disabled={!runtime.connected || runtime.pending} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold disabled:opacity-40">{runtime.pending ? 'Testing connection…' : 'Test configured key'}</button>}
            <button type="button" disabled={runtime.pending} onClick={() => setChangingKey(true)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">Change API key</button>
          </div>
        </div> : <>
        <label htmlFor="meta-key" className="flex items-center gap-2 text-xs font-medium"><KeyRound className="h-3.5 w-3.5" />Meta API key</label>
        <div className="flex flex-wrap gap-2">
          <input id="meta-key" type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" spellCheck={false}
            aria-describedby="meta-key-help" autoFocus={!info?.configured} maxLength={4096} disabled={!runtime.connected || runtime.pending}
            placeholder={info?.configured ? 'Enter a replacement key, or test the configured key.' : 'Paste your Meta API key here'}
            className="min-w-0 basis-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-indigo-400 disabled:opacity-40" />
          <button type="submit" disabled={!runtime.connected || runtime.pending || (!key.trim() && !info?.configured)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold disabled:opacity-40">
            {runtime.pending ? 'Testing connection…' : key.trim() || !info?.configured ? 'Connect & test' : 'Test configured key'}
          </button>
          {info?.configured && <button type="button" disabled={runtime.pending} onClick={() => { setKey(''); setChangingKey(false); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">Cancel change</button>}
        </div>
        </>}
        <p id="meta-key-help" className="text-xs leading-relaxed text-slate-400">Your key stays in this app session and is cleared from this field after submission. Connecting sends one short text request to Meta, uses a small amount of API credit, and sends no screenshots.</p>
        {runtime.setupError && <p role="alert" className="text-xs text-rose-300">{runtime.setupError}</p>}
      </form>
      <div className="mt-5 border-t border-slate-800 pt-4">
        <h3 className="mb-3 text-xs font-medium text-slate-300">Connection status · checked automatically</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {checks.map(check => <div key={check.label} className="flex items-center gap-2 rounded-xl bg-slate-950/70 p-3 text-xs">
            {check.ok ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-300" />}
            <span>{check.label}</span><span className="ml-auto text-slate-400">{check.ok ? 'Ready' : check.label === 'Meta text API' ? info?.configured ? 'Needs test' : 'Not connected' : ready ? 'Needs attention' : 'Checking…'}</span>
          </div>)}
        </div>
      </div>
      {ready && !ready.ready && <ul className="mt-4 list-disc space-y-1 border-t border-slate-800 pt-3 pl-4 text-xs leading-relaxed text-amber-200">
        {ready.issues.map(issue => <li key={issue}>{issue}</li>)}
      </ul>}
      <p className="mt-3 text-[11px] text-slate-500">This build operates one Ubuntu X11 test display. Emergency Stop: Ctrl + Shift + Escape.</p>
    </section>
  );
}
