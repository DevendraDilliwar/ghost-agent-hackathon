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
        return <MousePointer className="w-3.5 h-3.5 text-slate-600" />;
      case 'type':
        return <Terminal className="w-3.5 h-3.5 text-emerald-600" />;
      case 'key_press':
        return <Key className="w-3.5 h-3.5 text-amber-600" />;
      case 'verify':
        return <Eye className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
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
                ? 'bg-amber-50 border-amber-300 shadow-sm'
                : isExecuted
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  #{idx + 1}
                </span>
                <div className="p-1 rounded bg-slate-100 border border-slate-200">
                  {getActionIcon(action.type)}
                </div>
                <span className="font-semibold text-slate-800 capitalize">
                  {action.type.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isExecuted && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                )}
                {isFailed && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                    <XCircle className="w-3 h-3" /> {action.status === 'rejected' ? 'Rejected' : 'Failed'}
                  </span>
                )}
                {isAwaiting && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold animate-pulse">
                    <AlertCircle className="w-3 h-3" /> Needs Approval
                  </span>
                )}
                <span className="text-[10px] text-slate-500">{action.timestamp}</span>
              </div>
            </div>

            <div className="text-slate-700 font-normal pl-7">
              {action.description}
            </div>

            {action.coordinates && (
              <details className="pl-7 font-mono text-[10px] text-slate-500"><summary className="cursor-pointer">Position details</summary><div className="mt-1 flex items-center gap-2">
                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  x: {action.coordinates.x}, y: {action.coordinates.y}
                </span>
                {action.target && <span className="text-slate-500 truncate">Target: {action.target}</span>}
              </div></details>
            )}

            {action.verification && (
              <div className="pl-7 mt-0.5">
                <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] ${
                  action.verification.status === 'verified_success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                }`}>
                  <Eye className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="font-medium">{action.verification.summary}</span>
                </div>
              </div>
            )}

            {action.text && (
              <div className="pl-7 font-mono text-[10px] text-slate-700">
                <code className="bg-slate-50 px-2 py-1 rounded border border-slate-200 block max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {action.text}
                </code>
              </div>
            )}

            {isAwaiting && onApproveAction && onRejectAction && (
              <div className="mt-1 pt-2 border-t border-amber-200 flex items-center justify-end gap-2 pl-7">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRejectAction(action.id)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
                >
                  Reject & Stop
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onApproveAction(action.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>Approve & Auto-Run Rest</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
