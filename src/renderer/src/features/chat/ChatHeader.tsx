import { Eye, ShieldCheck, Sparkles, Settings2, ExternalLink } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';
import { statusLabels } from '../tasks/task-presentation';

interface ChatHeaderProps {
  status: AgentStatus;
  connected: boolean;
  ready: boolean | undefined;
  settingsDisabled: boolean;
  onOpenSetup: () => void;
  onCompact: () => void;
}

export function ChatHeader({ status, connected, ready, settingsDisabled, onOpenSetup, onCompact }: ChatHeaderProps) {
  const isReady = connected && ready === true;
  const statusLabel = !connected 
    ? 'Browser preview mode' 
    : status === 'idle' 
      ? (ready === true ? 'Desktop Ready' : 'Setup Required') 
      : statusLabels[status];

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#090d18] px-5 py-4 sm:px-6">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-400 p-[1px] shadow-lg shadow-indigo-500/20">
          <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-slate-950">
            <Sparkles className="h-5 w-5 text-sky-400 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-white">
              NoMCP
            </h1>
            <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-indigo-300">
              UNIVERSAL WORKER
            </span>
            <span className="hidden rounded-full border border-slate-700/60 bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-300 sm:inline-block">
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            Zero APIs · Zero Connectors · <span className="text-sky-400">Pure Vision</span>
          </p>
        </div>
      </div>

      {/* Agent loop role pills */}
      <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-950/30 px-2.5 py-1 text-sky-300" title="Observe: fresh screenshot of the selected desktop before every step">
          <Eye className="h-3 w-3 text-sky-400" />
          <span>Observe</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-950/30 px-2.5 py-1 text-violet-300" title="Think: one Meta model parses intent and proposes the next action">
          <Sparkles className="h-3 w-3 text-violet-400" />
          <span>Think</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1 text-emerald-300" title="Verify: screen-delta check plus typed-value readback (PRISM)">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>Verify</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenSetup}
          disabled={settingsDisabled}
          aria-haspopup="dialog"
          title={settingsDisabled ? 'Stop the active task to edit configuration.' : 'Configure Meta API keys and system settings.'}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-indigo-500/50 hover:bg-slate-800/80 hover:text-white disabled:opacity-40"
        >
          <Settings2 className="h-3.5 w-3.5 text-slate-400" />
          <span>Settings</span>
        </button>
        <button
          type="button"
          disabled={!connected}
          onClick={onCompact}
          className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/80 to-violet-600/80 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-indigo-500/30 disabled:opacity-40"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Floating HUD</span>
        </button>
      </div>
    </header>
  );
}
