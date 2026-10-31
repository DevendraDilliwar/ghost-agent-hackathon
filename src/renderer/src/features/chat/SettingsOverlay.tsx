import { ArrowLeft } from 'lucide-react';
import { ConnectionSetup } from '../environment/ConnectionSetup';
import type { TaskRuntimeView } from '../tasks/useTaskRuntime';

interface SettingsOverlayProps {
  runtime: TaskRuntimeView;
  onClose: () => void;
}

export function SettingsOverlay({ runtime, onClose }: SettingsOverlayProps) {
  return (
    <div role="dialog" aria-label="Settings" className="absolute inset-0 z-30 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />Back to chat
          </button>
        </div>
        <ConnectionSetup runtime={runtime} />
        <section aria-label="Safety" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Safety</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
            <li>Emergency stop: {runtime.readiness?.emergencyStopShortcut ?? 'unavailable'}. You can also pause or take control at any time; the agent never resumes on its own.</li>
            <li>Every run stays inside step, token, and five-minute limits. Nothing runs without your goal.</li>
            <li>Screenshots are sent to Meta&apos;s API to decide each step. Never type passwords or secrets into the target app.</li>
          </ul>
        </section>
        <p className="mt-4 text-center text-[11px] text-slate-400">NoMCP Universal Worker · your chat draft is kept while Settings is open.</p>
      </div>
    </div>
  );
}
