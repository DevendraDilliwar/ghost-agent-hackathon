import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Circle, KeyRound, RefreshCw } from 'lucide-react';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';

export function ConnectionSetup({ runtime }: { runtime: TaskRuntimeView }) {
  const [key, setKey] = useState('');
  const info = runtime.connection;
  const ready = runtime.readiness;
  function submit(event: FormEvent) {
    event.preventDefault();
    const candidate = key.trim() || null;
    setKey('');
    void runtime.connectModel(candidate);
  }
  const checks = [
    { label: 'Meta text API', ok: info?.verified === true },
    { label: 'Screen & input', ok: ready?.desktopSupported === true },
    { label: 'Emergency Stop', ok: ready?.emergencyStopReady === true },
  ];
  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="setup-title" className="text-sm font-semibold">Connect your desktop</h2>
          <p className="mt-1 text-xs text-slate-400">One-time setup for this app session.</p></div>
        <button type="button" onClick={runtime.refresh} disabled={runtime.pending} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">
          <RefreshCw className="h-3.5 w-3.5" />Recheck
        </button>
      </div>
      <div className="my-4 grid gap-2 sm:grid-cols-3">
        {checks.map(check => <div key={check.label} className="flex items-center gap-2 rounded-xl bg-slate-950/70 p-3 text-xs">
          {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-amber-300" />}
          <span>{check.label}</span><span className="ml-auto text-slate-400">{check.ok ? 'Ready' : 'Check'}</span>
        </div>)}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="meta-key" className="flex items-center gap-2 text-xs font-medium"><KeyRound className="h-3.5 w-3.5" />Meta API key</label>
        <div className="flex flex-wrap gap-2">
          <input id="meta-key" type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" spellCheck={false}
            maxLength={4096} disabled={runtime.pending} placeholder={info?.configured ? 'Key configured. Enter a replacement, or test it below.' : 'Paste your Meta API key'}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          <button type="submit" disabled={!runtime.connected || runtime.pending || (!key.trim() && !info?.configured)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold disabled:opacity-40">
            {runtime.pending ? 'Testing connection…' : key.trim() ? 'Connect & test' : 'Test configured key'}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">New keys stay in this app session only and are cleared from this field after submission. The test sends one short text request to Meta, uses a small amount of API credit, and sends no screenshots.</p>
        {info?.verified && <p role="status" className="text-xs text-emerald-300">Text API connected · {info.model}. Desktop computer-use will be checked during your task.</p>}
        {runtime.setupError && <p role="alert" className="text-xs text-rose-300">{runtime.setupError}</p>}
      </form>
      {ready && !ready.ready && <ul className="mt-4 list-disc space-y-1 border-t border-slate-800 pt-3 pl-4 text-xs leading-relaxed text-amber-200">
        {ready.issues.map(issue => <li key={issue}>{issue}</li>)}
      </ul>}
      <p className="mt-3 text-[11px] text-slate-500">This build operates one Ubuntu X11 test display. Emergency Stop: Ctrl + Shift + Escape.</p>
    </section>
  );
}
