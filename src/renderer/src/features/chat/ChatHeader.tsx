import { PanelRight, Settings2, ExternalLink, Square, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { statusLabels } from '../run/task-presentation';

interface ChatHeaderProps {
  status: AgentStatus;
  connected: boolean;
  ready: boolean | undefined;
  settingsDisabled: boolean;
  tokens: number;
  showStop: boolean;
  workspaceOpen: boolean;
  onToggleWorkspace: () => void;
  onStop: () => void;
  onOpenSetup: () => void;
  onCompact: () => void;
}

export function ChatHeader({ status, connected, ready, settingsDisabled, tokens, showStop, workspaceOpen, onToggleWorkspace, onStop, onOpenSetup, onCompact }: ChatHeaderProps) {
  const isReady = connected && ready === true;
  const statusLabel = !connected
    ? 'Browser preview mode'
    : status === 'idle'
      ? (ready === true ? 'Desktop Ready' : 'Setup Required')
      : statusLabels[status];

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <h1 className="shrink-0 text-sm font-extrabold tracking-tight text-slate-900">
          NoMCP
        </h1>
        <span className="hidden rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 sm:inline-block">
          UNIVERSAL WORKER
        </span>
        <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 md:inline-flex">
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {statusLabel}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {tokens > 0 && (
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600 lg:inline-block" title="Tokens used by the current run">
            {tokens}
          </span>
        )}
        <Button
          type="button"
          onClick={onToggleWorkspace}
          aria-pressed={workspaceOpen}
          title={workspaceOpen ? 'Hide the live workspace panel.' : 'Show the live workspace panel.'}
          variant="secondary"
          size="sm"
        >
          <PanelRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Workspace</span>
        </Button>
        <Button
          type="button"
          onClick={onOpenSetup}
          disabled={settingsDisabled}
          aria-haspopup="dialog"
          title={settingsDisabled ? 'Stop the active task to edit configuration.' : 'Configure Meta API keys and system settings.'}
          variant="secondary"
          size="sm"
        >
          <Settings2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
        <Button
          type="button"
          disabled={!connected}
          onClick={onCompact}
          variant="default"
          size="sm"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Floating HUD</span>
        </Button>
        {showStop && (
          <Button
            type="button"
            onClick={onStop}
            variant="destructive"
            size="sm"
            className="font-bold"
          >
            <Square className="h-3 w-3 fill-white" />
            <span>Stop</span>
          </Button>
        )}
      </div>
    </header>
  );
}
