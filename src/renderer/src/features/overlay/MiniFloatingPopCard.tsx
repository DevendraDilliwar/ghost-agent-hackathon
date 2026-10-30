import { Bot, Maximize2, Pause, Play, Square } from 'lucide-react';
import type { ControlsSnapshot } from '../../../../shared/contracts/controls';
import { isActiveTask, statusLabels } from '../tasks/task-presentation';

interface MiniFloatingPopCardProps {
  task: ControlsSnapshot | null;
  pending: boolean;
  error: string | null;
  onExpand: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function MiniFloatingPopCard({ task, pending, error, onExpand, onPause, onResume, onStop }: MiniFloatingPopCardProps) {
  const status = task?.status ?? 'idle';
  const active = Boolean(task?.runId) && isActiveTask(status);
  const resume = task?.canResume === true;
  const attention = ['awaiting_approval', 'needs_user', 'verifying', 'failed'].includes(status);
  return (
    <main className="h-screen overflow-hidden border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100">
      <header className="control-drag flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold"><Bot className="h-4 w-4 text-indigo-300" />Ghost Agent</span>
        <span role="status" className={'text-[11px] ' + (attention ? 'text-amber-300' : 'text-slate-300')}>{task ? status === 'idle' ? 'No active task' : statusLabels[status] : 'Connecting…'}</span>
      </header>
      <p className="mt-2 text-[11px] text-slate-400">{task ? task.executed + '/' + task.maxSteps + ' actions' : 'Waiting for desktop runtime'} · {task?.emergencyStopShortcut ? 'Stop: ' + task.emergencyStopShortcut : 'Drag the header to move'}</p>
      <div className="mt-3 flex items-center gap-2">
        {active && (resume
          ? <button type="button" disabled={pending} onClick={onResume} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] disabled:opacity-40"><Play className="h-3 w-3" />{status === 'needs_user' ? 'Done — resume' : 'Resume'}</button>
          : status !== 'needs_user' && <button type="button" disabled={pending} onClick={onPause} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-[11px] disabled:opacity-40"><Pause className="h-3 w-3" />Pause</button>)}
        {active && <button type="button" onClick={onStop} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-[11px]"><Square className="h-3 w-3" />Stop</button>}
        <button type="button" onClick={onExpand} className="ml-auto flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-[11px]"><Maximize2 className="h-3 w-3" />Open task</button>
      </div>
      {error && <p role="alert" className="mt-1 truncate text-[10px] text-rose-300" title={error}>{error}</p>}
    </main>
  );
}
