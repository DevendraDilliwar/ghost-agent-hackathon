import { Sparkles, Maximize2, Pause, Play, Square, GripHorizontal } from 'lucide-react';
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

export function MiniFloatingPopCard({
  task,
  pending,
  error,
  onExpand,
  onPause,
  onResume,
  onStop,
}: MiniFloatingPopCardProps) {
  const status = task?.status ?? 'idle';
  const active = Boolean(task?.runId) && isActiveTask(status);
  const resume = task?.canResume === true;
  const attention = ['awaiting_approval', 'needs_user', 'verifying', 'failed'].includes(status);

  return (
    <main className="h-screen overflow-hidden border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-xl">
      <header className="control-drag flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-3.5 w-3.5 text-slate-400 cursor-grab" />
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Sparkles className="h-3 w-3 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-900">NoMCP HUD</span>
        </div>

        <span
          role="status"
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            attention
              ? 'border border-amber-300 bg-amber-50 text-amber-700'
              : active
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-slate-200 bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {task ? (status === 'idle' ? 'Idle' : statusLabels[status]) : 'Connecting…'}
        </span>
      </header>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">
          {task ? `${task.executed}/${task.maxSteps} steps` : 'Runtime init'}
        </span>
        <span className="text-[10px] text-slate-400">
          {task?.emergencyStopShortcut ? `Stop: ${task.emergencyStopShortcut}` : 'Drag to move'}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {active && (
          resume ? (
            <button
              type="button"
              disabled={pending}
              onClick={onResume}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:opacity-40"
            >
              <Play className="h-3 w-3 fill-white" />
              <span>{status === 'needs_user' ? 'Done — Resume' : 'Resume'}</span>
            </button>
          ) : (
            status !== 'needs_user' && (
              <button
                type="button"
                disabled={pending}
                onClick={onPause}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-40"
              >
                <Pause className="h-3 w-3" />
                <span>Pause</span>
              </button>
            )
          )
        )}

        {active && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
          >
            <Square className="h-3 w-3 fill-white" />
            <span>Stop</span>
          </button>
        )}

        <button
          type="button"
          onClick={onExpand}
          className="ml-auto flex items-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Expand</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-1 truncate text-[10px] text-rose-600" title={error}>
          {error}
        </p>
      )}
    </main>
  );
}
