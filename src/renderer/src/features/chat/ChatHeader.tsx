import { Bot, PanelBottom, Settings2 } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { statusLabels } from '../tasks/task-presentation';

interface ChatHeaderProps {
  status: AgentStatus;
  connected: boolean;
  ready: boolean | undefined;
  onOpenSetup: () => void;
  onCompact: () => void;
}

export function ChatHeader({ status, connected, ready, onOpenSetup, onCompact }: ChatHeaderProps) {
  const label = !connected ? 'Browser layout preview' : status === 'idle' && ready !== true
    ? ready === undefined ? 'Checking desktop setup' : 'Complete setup to start' : statusLabels[status];
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-400"><Bot className="h-5 w-5" /></div>
        <div><h1 className="text-base font-bold">Ghost Agent <span className="ml-2 text-[10px] font-normal text-indigo-300">Preview</span></h1>
          <p className="mt-1 text-xs text-slate-400">{label}</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenSetup} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs"><Settings2 className="h-4 w-4" />Settings</button>
        <button type="button" disabled={!connected} onClick={onCompact} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs disabled:opacity-40"><PanelBottom className="h-4 w-4" />Floating controls</button>
      </div>
    </header>
  );
}
