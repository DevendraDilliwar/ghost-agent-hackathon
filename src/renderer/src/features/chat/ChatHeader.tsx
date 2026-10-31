import { Eye, ShieldCheck, Sparkles, Settings2, ExternalLink, Square } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { statusLabels } from '../tasks/task-presentation';

interface ChatHeaderProps {
  status: AgentStatus;
  connected: boolean;
  ready: boolean | undefined;
  settingsDisabled: boolean;
  tokens: number;
  showStop: boolean;
  onStop: () => void;
  onOpenSetup: () => void;
  onCompact: () => void;
}

export function ChatHeader({ status, connected, ready, settingsDisabled, tokens, showStop, onStop, onOpenSetup, onCompact }: ChatHeaderProps) {
  const isReady = connected && ready === true;
  const statusLabel = !connected 
    ? 'Browser preview mode' 
    : status === 'idle' 
      ? (ready === true ? 'Desktop Ready' : 'Setup Required') 
      : statusLabels[status];

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 p-[1px] shadow-sm">
          <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-slate-900">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">
              NoMCP
            </h1>
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600">
              UNIVERSAL WORKER
            </span>
            <span className="hidden rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 sm:inline-block">
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            Zero per-app APIs · Zero Connectors · <span className="text-emerald-600">Pure Vision</span>
          </p>
        </div>
      </div>

      {/* Agent loop role pills */}
      <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600" title="Observe: fresh screenshot of the selected desktop before every step">
          <Eye className="h-3 w-3 text-slate-500" />
          <span>Observe</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600" title="Think: one Meta model parses intent and proposes the next action">
          <Sparkles className="h-3 w-3 text-slate-500" />
          <span>Think</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700" title="Verify: screen-delta check plus typed-value readback (PRISM)">
          <ShieldCheck className="h-3 w-3 text-emerald-600" />
          <span>Verify</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {tokens > 0 && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600" title="Tokens used by the current run">
            {tokens} tokens
          </span>
        )}
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
          <span>Settings</span>
        </Button>
        <Button
          type="button"
          disabled={!connected}
          onClick={onCompact}
          variant="default"
          size="sm"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Floating HUD</span>
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
