import type { AgentStatus } from '../../../../shared/contracts/task';
import type { RunSummary } from '../../../../shared/contracts/history';
import { statusTone } from './task-presentation';

function StatusDot({ status }: { status: AgentStatus }) {
  const tone = statusTone(status);
  const color = tone === 'done' ? 'bg-emerald-500' : tone === 'failed' ? 'bg-rose-500' : tone === 'active' ? 'bg-amber-500' : 'bg-slate-400';
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

interface TaskHistoryListProps {
  runs: RunSummary[];
  activeRunId: string | null;
  selectedRunId: string | null;
  search: string;
  onSelect: (runId: string | null) => void;
}

/** Sidebar task history: the live run pinned on top, past runs below with status dots. */
export function TaskHistoryList({ runs, activeRunId, selectedRunId, search, onSelect }: TaskHistoryListProps) {
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
        </button>
      )}
      {past.map(run => (
        <button key={run.runId} type="button" className={`history-item history-task${selectedRunId === run.runId ? ' selected' : ''}`} title={run.goal || 'Untitled task'} onClick={() => onSelect(run.runId)}>
          <StatusDot status={run.status} />
          <span className="history-task-goal">{run.goal || 'Untitled task'}</span>
        </button>
      ))}
      {visible.length === 0 && <p className="navigation-empty">{runs.length === 0 ? 'No tasks yet. Start one from the chat.' : 'No tasks match this search.'}</p>}
    </div>
  );
}
