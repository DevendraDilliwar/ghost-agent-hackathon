import { Hand, Pause, Play, Square } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';

interface RunControlsProps {
  status: AgentStatus;
  disabled: boolean;
  emergencyStopShortcut: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTakeOver: () => void;
}

export function RunControls({ status, disabled, emergencyStopShortcut, onPause, onResume, onStop, onTakeOver }: RunControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">{emergencyStopShortcut ? emergencyStopShortcut + ' to stop' : 'Use Stop to end this task'}</p>
      <div className="flex gap-2">
        {status === 'paused' ? <button type="button" disabled={disabled} onClick={onResume} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Play className="h-3.5 w-3.5" />Resume</button>
          : status !== 'needs_user' && <button type="button" disabled={disabled} onClick={onPause} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"><Pause className="h-3.5 w-3.5" />Pause</button>}
        {status !== 'needs_user' && <button type="button" disabled={disabled} onClick={onTakeOver} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"><Hand className="h-3.5 w-3.5" />Take control</button>}
        <button type="button" onClick={onStop} className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white"><Square className="h-3.5 w-3.5" />Stop</button>
      </div>
    </div>
  );
}
