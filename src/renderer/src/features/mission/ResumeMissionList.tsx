import { useCallback, useEffect, useState } from 'react';
import { History, Play, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { MissionSummary } from '../../../../shared/contracts/mission';

interface ResumeMissionListProps {
  disabled: boolean;
  listMissions: () => Promise<MissionSummary[]>;
  onResume: (mission: MissionSummary) => void;
}

function resumable(mission: MissionSummary): boolean {
  return mission.phases.length > 0 && mission.phases.some(phase => phase.status === 'failed' || phase.status === 'active');
}

export function ResumeMissionList({ disabled, listMissions, onResume }: ResumeMissionListProps) {
  const [missions, setMissions] = useState<MissionSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    listMissions().then(
      found => { setMissions(found.filter(resumable)); setLoading(false); },
      () => { setMissions([]); setLoading(false); },
    );
  }, [listMissions]);

  useEffect(() => {
    let cancelled = false;
    listMissions().then(
      found => { if (!cancelled) { setMissions(found.filter(resumable)); setLoading(false); } },
      () => { if (!cancelled) { setMissions([]); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [listMissions]);

  if (missions === null || missions.length === 0) return null;
  return (
    <section aria-label="Interrupted missions" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <History className="h-3.5 w-3.5 text-slate-400" />Interrupted missions
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading || disabled} title="Refresh the list">
          <RefreshCw className={`h-3 w-3 ${loading ? 'motion-safe:animate-spin' : ''}`} />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {missions.map(mission => {
          const done = mission.phases.filter(phase => phase.status === 'done').length;
          const stuck = mission.phases.find(phase => phase.status === 'failed') ?? mission.phases.find(phase => phase.status === 'active');
          return (
            <li key={mission.missionId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{mission.goal}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {done}/{mission.phases.length} phases{stuck ? ` · ${stuck.status === 'failed' ? 'stuck' : 'paused'}: ${stuck.goal}` : ''}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onResume(mission)} title="Resume this mission where it stopped">
                <Play className="h-3 w-3" /><span>Resume</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
