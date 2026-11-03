import { useState } from 'react';
import { MoreVertical, Paperclip, Trash2 } from 'lucide-react';
import type { AgentStatus } from '../../../../shared/contracts/task';
import type { RunSummary } from '../../../../shared/contracts/history';
import { statusTone } from './task-presentation';

function StatusDot({ status }: { status: AgentStatus }) {
  const tone = statusTone(status);
  const color = tone === 'done' ? 'bg-emerald-500' : tone === 'failed' ? 'bg-rose-500' : tone === 'active' ? 'bg-amber-500' : 'bg-slate-400';
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function AttachmentMark({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <span className="history-attachment" title={names.join(', ')}>
      <Paperclip size={12} aria-hidden="true" />{names.length > 1 ? names.length : ''}
    </span>
  );
}

function RowMenu({ runId, goal, onDelete }: { runId: string; goal: string; onDelete: (runId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const label = goal || 'Untitled task';
  if (!open) {
    return (
      <button type="button" className="history-menu-button" aria-label={'Options for ' + label} aria-haspopup="menu"
        aria-expanded={false} title="Task options"
        onClick={event => { event.stopPropagation(); setOpen(true); }}>
        <MoreVertical size={14} aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className="history-menu" role="menu" aria-label={'Options for ' + label}>
      {!confirming ? (
        <button type="button" role="menuitem" className="history-menu-delete"
          onClick={event => { event.stopPropagation(); setConfirming(true); }}>
          <Trash2 size={13} aria-hidden="true" />Delete
        </button>
      ) : (
        <>
          <button type="button" role="menuitem" className="history-menu-confirm"
            onClick={event => { event.stopPropagation(); onDelete(runId); }}>
            Confirm delete
          </button>
          <button type="button" role="menuitem"
            onClick={event => { event.stopPropagation(); setOpen(false); setConfirming(false); }}>
            Cancel
          </button>
        </>
      )}
    </span>
  );
}

interface TaskHistoryListProps {
  runs: RunSummary[];
  activeRunId: string | null;
  selectedRunId: string | null;
  search: string;
  onSelect: (runId: string | null) => void;
  onDelete: (runId: string) => void;
}

/** Sidebar task history: the live run pinned on top, past runs below with status dots. Past runs carry a ⋮ menu to delete them; the live run is never deletable. */
export function TaskHistoryList({ runs, activeRunId, selectedRunId, search, onSelect, onDelete }: TaskHistoryListProps) {
  const query = search.trim().toLowerCase();
  const visible = query ? runs.filter(run => run.goal.toLowerCase().includes(query)) : runs;
  const active = visible.find(run => run.runId === activeRunId) ?? null;
  const past = visible.filter(run => run.runId !== activeRunId);
  return (
    <div className="navigation-history">
      <h2 className="navigation-history-title">Tasks</h2>
      {active && (
        <button type="button" className={`history-item history-task${selectedRunId === null ? ' selected' : ''}`} title={active.goal || 'Current task'} onClick={() => onSelect(null)}>
          <StatusDot status={active.status} />
          <span className="history-task-goal">{active.goal || 'Current task'}</span>
          <AttachmentMark names={active.attachmentNames ?? []} />
        </button>
      )}
      {past.map(run => (
        <div key={run.runId} className={`history-item history-task${selectedRunId === run.runId ? ' selected' : ''}`}>
          <button type="button" className="history-task-select" title={run.goal || 'Untitled task'} aria-label={'Open ' + (run.goal || 'Untitled task')} onClick={() => onSelect(run.runId)}>
            <StatusDot status={run.status} />
            <span className="history-task-goal">{run.goal || 'Untitled task'}</span>
            <AttachmentMark names={run.attachmentNames ?? []} />
          </button>
          <RowMenu runId={run.runId} goal={run.goal} onDelete={onDelete} />
        </div>
      ))}
      {visible.length === 0 && <p className="navigation-empty">{runs.length === 0 ? 'No tasks yet. Start one from the chat.' : 'No tasks match this search.'}</p>}
    </div>
  );
}
