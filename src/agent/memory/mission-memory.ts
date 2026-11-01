import { isDomainId } from '../../shared/contracts/mission';
import type { DomainId, MissionPlan, PhaseContext, PhaseRecord, PhaseStatus } from '../../shared/contracts/mission';

/**
 * Mission memory — the agent's human-like memory of a multi-phase task.
 *
 * One user goal ("set up my repo on GitHub + GCP + Vercel") becomes a plan of
 * domain-separated phases. Each phase keeps its own goal, status and notes so
 * GCP facts never leak into the Vercel context and completed phases are never
 * redone. Only one phase is active at a time: the agent has one focus, like us.
 */

const maxGoal = 2000;
const maxPhaseGoal = 500;
const maxNote = 500;
const maxNotesPerPhase = 50;
const maxPhases = 20;
const maxSteps = 12;
const maxStep = 200;
const maxSuccess = 500;
const nul = String.fromCharCode(0);

function bounded(text: string, limit: number, label: string): string {
  if (typeof text !== 'string' || !text.trim() || text.length > limit || text.includes(nul)) {
    throw new Error('Invalid mission ' + label + '.');
  }
  return text.trim();
}

function validStatus(status: unknown): status is PhaseStatus {
  return status === 'pending' || status === 'active' || status === 'done' || status === 'failed';
}

function checkSteps(steps: unknown): string[] {
  if (!Array.isArray(steps) || steps.length > maxSteps) throw new Error('Invalid mission steps.');
  return steps.map(step => bounded(step, maxStep, 'phase step'));
}

function checkSuccess(success: unknown): string {
  if (typeof success !== 'string' || success.length > maxSuccess || success.includes(nul)) {
    throw new Error('Invalid mission success condition.');
  }
  return success;
}

function checkStepProgress(steps: string[], completed: unknown, active: unknown): { completedSteps: number[]; activeStep: number | null } {
  if (!Array.isArray(completed) || completed.length > maxSteps) throw new Error('Invalid mission step progress.');
  const done = [...new Set(completed)];
  for (const index of done) {
    if (!Number.isSafeInteger(index) || (index as number) < 0 || (index as number) >= steps.length) {
      throw new Error('Invalid mission step progress.');
    }
  }
  if (active !== null && (!Number.isSafeInteger(active) || (active as number) < 0 || (active as number) >= steps.length)) {
    throw new Error('Invalid mission step progress.');
  }
  return { completedSteps: (done as number[]).sort((a, b) => a - b), activeStep: active as number | null };
}

export class MissionMemory {
  private readonly phases = new Map<string, PhaseRecord>();
  private readonly createdAt: number;
  private phaseCounter = 0;

  constructor(
    private readonly missionId: string,
    private readonly goal: string,
    private readonly now: () => number = Date.now,
  ) {
    bounded(missionId, 80, 'id');
    bounded(goal, maxGoal, 'goal');
    this.createdAt = this.now();
  }

  /** Rebuilds memory from a persisted plan (resume path). Validates shape. */
  static restore(plan: MissionPlan): MissionMemory {
    const memory = new MissionMemory(plan.missionId, plan.goal);
    if (!Array.isArray(plan.phases) || plan.phases.length > maxPhases) throw new Error('Invalid mission plan.');
    for (const phase of plan.phases) {
      if (!isDomainId(phase.domain) || !validStatus(phase.status)) throw new Error('Invalid mission phase.');
      const steps = checkSteps(phase.steps);
      const progress = checkStepProgress(steps, phase.completedSteps, phase.activeStep);
      const record: PhaseRecord = {
        phaseId: bounded(phase.phaseId, 80, 'phase id'),
        domain: phase.domain,
        goal: bounded(phase.goal, maxPhaseGoal, 'phase goal'),
        status: phase.status,
        notes: [...phase.notes],
        steps,
        completedSteps: progress.completedSteps,
        activeStep: progress.activeStep,
        success: checkSuccess(phase.success),
        startedAt: phase.startedAt,
        finishedAt: phase.finishedAt,
      };
      if (record.notes.length > maxNotesPerPhase || record.notes.some(note => typeof note !== 'string' || !note || note.length > maxNote)) {
        throw new Error('Invalid mission notes.');
      }
      if (memory.phases.has(record.phaseId)) throw new Error('Duplicate mission phase.');
      memory.phases.set(record.phaseId, record);
      const counter = Number(/^phase-([0-9]{1,3})$/.exec(record.phaseId)?.[1]);
      if (Number.isSafeInteger(counter)) memory.phaseCounter = Math.max(memory.phaseCounter, counter);
    }
    return memory;
  }

  addPhase(domain: DomainId, goal: string, opts?: { steps?: string[]; success?: string }): PhaseRecord {
    if (!isDomainId(domain)) throw new Error('Invalid mission domain.');
    if (this.phases.size >= maxPhases) throw new Error('Too many mission phases.');
    const phase: PhaseRecord = {
      phaseId: 'phase-' + ++this.phaseCounter,
      domain,
      goal: bounded(goal, maxPhaseGoal, 'phase goal'),
      status: 'pending',
      notes: [],
      steps: checkSteps(opts?.steps ?? []),
      completedSteps: [],
      activeStep: null,
      success: checkSuccess(opts?.success ?? ''),
      startedAt: null,
      finishedAt: null,
    };
    this.phases.set(phase.phaseId, phase);
    return this.snapshot(phase);
  }

  startPhase(phaseId: string): PhaseRecord {
    const phase = this.require(phaseId);
    if (phase.status !== 'pending') throw new Error('Only a pending phase can start.');
    for (const other of this.phases.values()) {
      if (other.status === 'active') throw new Error('Finish the active phase before starting another.');
    }
    return this.store({ ...phase, status: 'active', startedAt: this.now() });
  }

  completePhase(phaseId: string, note?: string): PhaseRecord {
    const phase = this.require(phaseId);
    if (phase.status !== 'active') throw new Error('Only the active phase can complete.');
    const notes = note === undefined ? phase.notes : [...phase.notes, bounded(note, maxNote, 'note')];
    return this.store({ ...phase, status: 'done', notes, finishedAt: this.now(),
      completedSteps: phase.steps.map((_, index) => index), activeStep: null });
  }

  failPhase(phaseId: string, reason: string): PhaseRecord {
    const phase = this.require(phaseId);
    if (phase.status !== 'active') throw new Error('Only the active phase can fail.');
    const notes = [...phase.notes, 'FAILED: ' + bounded(reason, maxNote, 'failure reason')];
    return this.store({ ...phase, status: 'failed', notes, finishedAt: this.now() });
  }

  /**
   * Replace stale pending phases with a fresh plan. The caller fails the
   * active phase first. Completed and failed phases stay as history; every
   * new phase is validated before anything is dropped.
   */
  replanRemaining(phases: Array<{ domain: DomainId; goal: string; steps: string[]; success: string }>): PhaseRecord {
    if (!phases.length) throw new Error('The replan came back empty.');
    for (const phase of phases) {
      if (!isDomainId(phase.domain)) throw new Error('Invalid mission domain.');
      bounded(phase.goal, maxPhaseGoal, 'phase goal');
      checkSteps(phase.steps);
      checkSuccess(phase.success);
    }
    for (const phase of this.phases.values()) {
      if (phase.status === 'active') throw new Error('Finish the active phase before replanning.');
    }
    const settled = [...this.phases.values()].filter(phase => phase.status !== 'pending').length;
    if (settled + phases.length > maxPhases) throw new Error('Too many mission phases.');
    for (const [phaseId, phase] of this.phases) {
      if (phase.status === 'pending') this.phases.delete(phaseId);
    }
    let first: PhaseRecord | null = null;
    for (const phase of phases) {
      const record = this.addPhase(phase.domain, phase.goal, { steps: phase.steps, success: phase.success });
      first ??= record;
    }
    return first!;
  }

  /** Resume path: a failed phase becomes active again, keeping its history. */
  reactivatePhase(phaseId: string): PhaseRecord {
    const phase = this.require(phaseId);
    if (phase.status !== 'failed') throw new Error('Only a failed phase can restart.');
    for (const other of this.phases.values()) {
      if (other.status === 'active') throw new Error('Finish the active phase before restarting another.');
    }
    return this.store({ ...phase, status: 'active', finishedAt: null });
  }

  addNote(phaseId: string, note: string): PhaseRecord {
    const phase = this.require(phaseId);
    if (phase.notes.length >= maxNotesPerPhase) throw new Error('Too many notes on one phase.');
    return this.store({ ...phase, notes: [...phase.notes, bounded(note, maxNote, 'note')] });
  }

  /**
   * Moves the live step pointer from the model's [step N] tag (1-based).
   * Best-effort and monotonic: invalid or backward tags leave it untouched.
   */
  noteActiveStep(phaseId: string, oneBased: number): PhaseRecord {
    const phase = this.require(phaseId);
    const index = oneBased - 1;
    if (!Number.isSafeInteger(oneBased) || index < 0 || index >= phase.steps.length) return this.snapshot(phase);
    if (phase.activeStep !== null && index <= phase.activeStep) return this.snapshot(phase);
    return this.store({ ...phase, activeStep: index });
  }

  /**
   * Verified audit: exact set of complete steps (0-based). Out-of-range
   * entries are dropped; the pointer settles on the first incomplete step.
   */
  setCompletedSteps(phaseId: string, done: number[]): PhaseRecord {
    const phase = this.require(phaseId);
    const valid = [...new Set(done)]
      .filter((index): index is number => Number.isSafeInteger(index) && index >= 0 && index < phase.steps.length)
      .sort((a, b) => a - b);
    const next = phase.steps.findIndex((_, index) => !valid.includes(index));
    return this.store({ ...phase, completedSteps: valid, activeStep: next < 0 ? null : next });
  }

  /** Domain-scoped context: this phase's goal, status and notes ONLY. */
  getPhaseContext(phaseId: string): PhaseContext {
    const phase = this.require(phaseId);
    return { phaseId: phase.phaseId, domain: phase.domain, goal: phase.goal, status: phase.status,
      notes: [...phase.notes], steps: [...phase.steps], success: phase.success };
  }

  currentPhase(): PhaseRecord | null {
    for (const phase of this.phases.values()) {
      if (phase.status === 'active') return this.snapshot(phase);
    }
    return null;
  }

  nextPending(): PhaseRecord | null {
    for (const phase of this.phases.values()) {
      if (phase.status === 'pending') return this.snapshot(phase);
    }
    return null;
  }

  getPlan(): MissionPlan {
    return {
      missionId: this.missionId,
      goal: this.goal,
      phases: [...this.phases.values()].map(phase => this.snapshot(phase)),
      createdAt: this.createdAt,
    };
  }

  private require(phaseId: string): PhaseRecord {
    const phase = this.phases.get(phaseId);
    if (!phase) throw new Error('Unknown mission phase.');
    return phase;
  }

  private store(phase: PhaseRecord): PhaseRecord {
    this.phases.set(phase.phaseId, phase);
    return this.snapshot(phase);
  }

  private snapshot(phase: PhaseRecord): PhaseRecord {
    return { ...phase, notes: [...phase.notes], steps: [...phase.steps], completedSteps: [...phase.completedSteps] };
  }
}
