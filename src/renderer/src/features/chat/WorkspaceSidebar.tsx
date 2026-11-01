import { X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { TaskRuntimeView } from '../run/useTaskRuntime';
import { WorkspacePane } from './WorkspacePane';

interface WorkspaceSidebarProps {
  runtime: TaskRuntimeView;
  open: boolean;
  onClose: () => void;
}

/** Collapsible live-workspace drawer: screenshots, mission graph, intent. */
export function WorkspaceSidebar({ runtime, open, onClose }: WorkspaceSidebarProps) {
  if (!open) return null;
  return (
    <aside aria-label="Live workspace" className="flex min-h-[280px] w-full flex-col border-t border-slate-200 bg-slate-50 lg:w-[400px] lg:min-h-0 lg:flex-none lg:border-l lg:border-t-0">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <h2 className="text-xs font-bold text-slate-700">Live workspace</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} title="Hide the live workspace panel">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <WorkspacePane runtime={runtime} />
      </div>
    </aside>
  );
}
