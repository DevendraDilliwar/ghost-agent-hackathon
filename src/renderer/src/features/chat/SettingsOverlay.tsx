import { ArrowLeft, Check, Shield, Zap } from 'lucide-react';
import { ConnectionSetup } from '../environment/ConnectionSetup';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import type { ApprovalMode } from '../../../../shared/contracts/task';
import { Button } from '../../components/ui/button';

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

const stepOptions = [10, 25, 50, 100];
const minuteOptions = [5, 15, 30, 60];

export function SettingsOverlay({
  runtime,
  approvalMode, setApprovalMode,
  screenConsent, setScreenConsent,
  isolatedEnvironment, setIsolatedEnvironment,
  maxSteps, setMaxSteps,
  maxMinutes, setMaxMinutes,
  onClose,
}: SettingsOverlayProps) {
  return (
    <div role="dialog" aria-label="Settings" className="absolute inset-0 z-30 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Settings</h2>
          <Button type="button" onClick={onClose} variant="secondary" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />Back to chat
          </Button>
        </div>
        <ConnectionSetup runtime={runtime} />
        <section aria-label="Run defaults" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Run defaults</h3>
          <p className="mt-1 text-xs text-slate-500">Used for every task until you change them.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setApprovalMode('full_access')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all cursor-pointer ${
                approvalMode === 'full_access'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>Full Autonomous Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setApprovalMode('ask_approval')}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-semibold transition-all cursor-pointer ${
                approvalMode === 'ask_approval'
                  ? 'border border-slate-200 bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span>Step-by-Step Approval</span>
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-700">Max steps per run</p>
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-xs">
                {stepOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMaxSteps(option)}
                    aria-pressed={maxSteps === option}
                    className={`rounded-xl px-2 py-1.5 font-bold transition-all cursor-pointer ${
                      maxSteps === option ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-700">Time limit per run</p>
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-xs">
                {minuteOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMaxMinutes(option)}
                    aria-pressed={maxMinutes === option}
                    className={`rounded-xl px-2 py-1.5 font-bold transition-all cursor-pointer ${
                      maxMinutes === option ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {option}m
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <label className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer ${
              screenConsent ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                screenConsent ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {screenConsent && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <input
                type="checkbox"
                checked={screenConsent}
                onChange={e => setScreenConsent(e.target.checked)}
                className="sr-only"
              />
              <span className="text-[11px] leading-tight text-slate-600">
                Allow AI vision processing of desktop screenshots
              </span>
            </label>
            <label className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer ${
              isolatedEnvironment ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isolatedEnvironment ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {isolatedEnvironment && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <input
                type="checkbox"
                checked={isolatedEnvironment}
                onChange={e => setIsolatedEnvironment(e.target.checked)}
                className="sr-only"
              />
              <span className="text-[11px] leading-tight text-slate-600">
                Running on verified test desktop environment
              </span>
            </label>
          </div>
        </section>
        <section aria-label="Safety" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Safety</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
            <li>Emergency stop: {runtime.readiness?.emergencyStopShortcut ?? 'unavailable'}. You can also pause or take control at any time; the agent never resumes on its own.</li>
            <li>Every run stays inside step, token, and time limits. Nothing runs without your goal.</li>
            <li>Screenshots are sent to Meta&apos;s API to decide each step. Never type passwords or secrets into the target app.</li>
          </ul>
        </section>
        <p className="text-center text-[11px] text-slate-400">NoMCP Universal Worker · your chat draft is kept while Settings is open.</p>
      </div>
    </div>
  );
}
