import React from 'react';
import { MousePointer, Terminal, Key, Eye, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { AgentAction } from '../../../../shared/contracts/task';

interface ActionTimelineProps {
  actions: AgentAction[];
  disabled?: boolean;
  onApproveAction?: ((actionId: string) => void) | undefined;
  onRejectAction?: ((actionId: string) => void) | undefined;
}

export const ActionTimeline: React.FC<ActionTimelineProps> = ({
  actions,
  disabled = false,
  onApproveAction,
  onRejectAction,
}) => {
  if (actions.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
        <Clock className="w-5 h-5 mb-2 opacity-40 animate-spin" style={{ animationDuration: '4s' }} />
        <span>Agent is observing the desktop...</span>
      </div>
    );
  }

  const getActionIcon = (type: AgentAction['type']) => {
    switch (type) {
      case 'click':
      case 'double_click':
        return <MousePointer className="w-3.5 h-3.5 text-sky-400" />;
      case 'type':
        return <Terminal className="w-3.5 h-3.5 text-indigo-400" />;
      case 'key_press':
        return <Key className="w-3.5 h-3.5 text-amber-400" />;
      case 'verify':
        return <Eye className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {actions.map((action, idx) => {
        const isAwaiting = action.status === 'awaiting_approval';
        const isExecuted = action.status === 'executed';
        const isFailed = action.status === 'failed' || action.status === 'rejected';

        return (
          <div
            key={action.id}
            className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 ${
              isAwaiting
                ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10'
                : isExecuted
                ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                : 'bg-slate-950/40 border-slate-800/40 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  #{idx + 1}
                </span>
                <div className="p-1 rounded bg-slate-800/80 border border-slate-700/50">
                  {getActionIcon(action.type)}
                </div>
                <span className="font-semibold text-slate-200 capitalize">
                  {action.type.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isExecuted && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                )}
                {isFailed && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-400 font-medium">
                    <XCircle className="w-3 h-3" /> {action.status === 'rejected' ? 'Rejected' : 'Failed'}
                  </span>
                )}
                {isAwaiting && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold animate-pulse">
                    <AlertCircle className="w-3 h-3" /> Needs Approval
                  </span>
                )}
                <span className="text-[10px] text-slate-500">{action.timestamp}</span>
              </div>
            </div>

            <div className="text-slate-300 font-normal pl-7">
              {action.description}
            </div>

            {action.coordinates && (
              <details className="pl-7 font-mono text-[10px] text-slate-400"><summary className="cursor-pointer">Position details</summary><div className="mt-1 flex items-center gap-2">
                <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  x: {action.coordinates.x}, y: {action.coordinates.y}
                </span>
                {action.target && <span className="text-slate-400 truncate">Target: {action.target}</span>}
              </div></details>
            )}

            {action.text && (
              <div className="pl-7 font-mono text-[10px] text-emerald-300">
                <code className="bg-slate-950 px-2 py-1 rounded border border-slate-800 block max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {action.text}
                </code>
              </div>
            )}

            {isAwaiting && onApproveAction && onRejectAction && (
              <div className="mt-1 pt-2 border-t border-amber-500/20 flex items-center justify-end gap-2 pl-7">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRejectAction(action.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] transition-colors"
                >
                  Reject & Stop
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onApproveAction(action.id)}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] transition-colors shadow-sm"
                >
                  Approve & Execute
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
