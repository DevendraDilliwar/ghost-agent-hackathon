import { CheckCircle2, Circle, Loader2, RotateCcw, Target, XCircle } from 'lucide-react';
import type { MissionPlan, PhaseRecord, PhaseStatus } from '../../../../shared/contracts/mission';

function StatusIcon({ status }: { status: PhaseStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="done" />;
  if (status === 'active') return <Loader2 className="h-4 w-4 shrink-0 text-amber-600 motion-safe:animate-spin" aria-label="in progress" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-label="failed" />;
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-label="pending" />;
}

export type StepState = 'done' | 'active' | 'failed' | 'pending';

/** Derives one step's display state from verified completions plus the live pointer trail. */
export function stepState(phase: PhaseRecord, index: number): StepState {
  if (phase.status === 'done') return 'done';
  if (phase.completedSteps.includes(index)) return 'done';
  const pointer = phase.activeStep;
  if (phase.status === 'failed') {
    if (pointer === null) return 'pending';
    if (index < pointer) return 'done';
    return index === pointer ? 'failed' : 'pending';
  }
  if (phase.status !== 'active') return 'pending';
  if (pointer === null) return index === 0 ? 'active' : 'pending';
  if (index < pointer) return 'done';
  return index === pointer ? 'active' : 'pending';
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" aria-label="step done" />;
  if (state === 'active') return <Loader2 className="h-3 w-3 shrink-0 text-amber-600 motion-safe:animate-spin" aria-label="step in progress" />;
  if (state === 'failed') return <XCircle className="h-3 w-3 shrink-0 text-rose-500" aria-label="step failed" />;
  return <Circle className="h-3 w-3 shrink-0 text-slate-300" aria-label="step pending" />;
}

/** Retry intent injected as a phase note so the model refocuses on the failed step. */
export function buildRetryNote(phase: PhaseRecord): string {
  const stepIndex = phase.activeStep ?? 0;
  const stepText = phase.steps[stepIndex]?.slice(0, 200);
  return ('Retry requested from step ' + (stepIndex + 1) + (stepText ? ': ' + stepText : '') +
    '. The previous attempt failed — try a different approach for this step.').slice(0, 500);
}

/**
 * Mission graph: goal as the root node, domain phases as branches, planned
 * steps as leaves. The active branch stays highlighted so the user always
 * sees where the task stands. Steps expand on active/failed phases only.
 * Failed branches offer a one-click retry from the frozen step.
 */
export function MissionGraph({ mission, onRetryPhase }: { mission: MissionPlan | null; onRetryPhase?: ((phaseId: string) => void) | undefined }) {
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
                  {phase.status === 'done' && phase.steps.length > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-700">{phase.steps.length}/{phase.steps.length} steps complete</p>
                  )}
                  {(phase.status === 'active' || phase.status === 'failed') && phase.steps.length > 0 && (
                    <ol className="mt-1.5 space-y-1 border-l-2 border-slate-200 pl-3">
                      {phase.steps.map((step, index) => {
                        const state = stepState(phase, index);
                        return (
                          <li key={step + index} className={`flex items-center gap-1.5 truncate text-[11px] ${
                            state === 'done' ? 'text-emerald-700'
                              : state === 'active' ? 'font-medium text-amber-700'
                                : state === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>
                            <StepIcon state={state} />
                            <span className="truncate">{index + 1}. {step}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {phase.status === 'failed' && onRetryPhase && (
                    <button type="button" onClick={() => onRetryPhase(phase.phaseId)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry from step {(phase.activeStep ?? 0) + 1}
                    </button>
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
