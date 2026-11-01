import { Hand, Pause, Play, Square } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { Button } from '../../components/ui/button';

interface RunControlsProps {
  status: AgentStatus;
  disabled: boolean;
  emergencyStopShortcut: string | null;
  onPause: () => void;
  onResume: () => void;
  onTakeOver: () => void;
  onStop?: () => void;
}

export function RunControls({
  status,
  disabled,
  emergencyStopShortcut,
  onPause,
  onResume,
  onTakeOver,
  onStop,
}: RunControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-slate-700">Autonomous Active</span>
        <span className="text-[11px] text-slate-400">
          ({emergencyStopShortcut ?? 'Ctrl+Alt+S'} to stop)
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {status === 'paused' ? (
          <Button type="button" disabled={disabled} onClick={onResume} variant="success" size="sm" className="h-7 text-xs font-bold">
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
        ) : (
          status !== 'needs_user' && (
            <Button type="button" disabled={disabled} onClick={onPause} variant="secondary" size="sm" className="h-7 text-xs">
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )
        )}
        {status !== 'needs_user' && (
          <Button type="button" disabled={disabled} onClick={onTakeOver} variant="secondary" size="sm" className="h-7 text-xs">
            <Hand className="h-3 w-3 mr-1" />
            Take Control
          </Button>
        )}
        {onStop && (
          <Button type="button" disabled={disabled} onClick={onStop} variant="destructive" size="sm" className="h-7 text-xs font-bold">
            <Square className="h-2.5 w-2.5 mr-1 fill-white" />
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
