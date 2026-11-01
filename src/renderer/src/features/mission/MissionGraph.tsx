import { CheckCircle2, Circle, Loader2, Target, XCircle } from 'lucide-react';
import type { MissionPlan, PhaseStatus } from '../../../../shared/contracts/mission';

function StatusIcon({ status }: { status: PhaseStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="done" />;
  if (status === 'active') return <Loader2 className="h-4 w-4 shrink-0 text-amber-600 motion-safe:animate-spin" aria-label="in progress" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-label="failed" />;
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-label="pending" />;
}

/**
 * Mission graph: goal as the root node, domain phases as branches, planned
 * steps as leaves. The active branch stays highlighted so the user always
 * sees where the task stands. Steps expand on active/failed phases only.
 */
export function MissionGraph({ mission }: { mission: MissionPlan | null }) {
  if (!mission || mission.phases.length === 0) return null;
  const done = mission.phases.filter(phase => phase.status === 'done').length;
  const percent = Math.round((done / mission.phases.length) * 100);
  return (
    <section aria-label="Mission graph" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-bold text-slate-700">Mission graph</h3>
      <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="truncate text-xs font-bold" title={mission.goal}>{mission.goal}</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-700" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Phases complete">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: percent + '%' }} />
          </div>
          <span className="font-mono text-[11px] text-slate-300">{done}/{mission.phases.length}</span>
        </div>
      </div>
      <ol className="mt-1 space-y-2 border-l-2 border-slate-200 pl-4 pt-2">
        {mission.phases.map(phase => (
          <li key={phase.phaseId} className="relative before:absolute before:-left-4 before:top-5 before:h-0.5 before:w-4 before:bg-slate-200">
            <div className={`rounded-lg px-2.5 py-2 ${phase.status === 'active' ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5"><StatusIcon status={phase.status} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600">{phase.domain}</span>
                    <span className="truncate text-xs font-medium text-slate-800">{phase.goal}</span>
                  </div>
                  {phase.status === 'failed' && phase.notes.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-rose-600">{phase.notes.at(-1)}</p>
                  )}
                  {(phase.status === 'active' || phase.status === 'failed') && phase.steps.length > 0 && (
                    <ol className="mt-1.5 space-y-1 border-l-2 border-slate-200 pl-3">
                      {phase.steps.map((step, index) => (
                        <li key={step + index} className="truncate text-[11px] text-slate-500">{index + 1}. {step}</li>
                      ))}
                    </ol>
                  )}
                  {phase.status === 'active' && phase.success && (
                    <p className="mt-1 truncate text-[11px] text-slate-500">Done when: {phase.success}</p>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
