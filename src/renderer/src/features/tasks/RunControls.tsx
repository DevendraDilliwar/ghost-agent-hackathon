import { Hand, Pause, Play } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { Button } from '../../components/ui/button';

interface RunControlsProps {
  status: AgentStatus;
  disabled: boolean;
  emergencyStopShortcut: string | null;
  onPause: () => void;
  onResume: () => void;
  onTakeOver: () => void;
}

export function RunControls({ status, disabled, emergencyStopShortcut, onPause, onResume, onTakeOver }: RunControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">{emergencyStopShortcut ? emergencyStopShortcut + ' to stop' : 'Use Stop above to end this task'}</p>
      <div className="flex gap-2">
        {status === 'paused' ? <Button type="button" disabled={disabled} onClick={onResume} variant="success" size="sm"><Play className="h-3.5 w-3.5" />Resume</Button>
          : status !== 'needs_user' && <Button type="button" disabled={disabled} onClick={onPause} variant="secondary" size="sm"><Pause className="h-3.5 w-3.5" />Pause</Button>}
        {status !== 'needs_user' && <Button type="button" disabled={disabled} onClick={onTakeOver} variant="secondary" size="sm"><Hand className="h-3.5 w-3.5" />Take control</Button>}
      </div>
    </div>
  );
}
