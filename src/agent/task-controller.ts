import type { AgentAction, ApprovalMode, RunConfiguration, TaskSnapshot, UserHandoff } from '../shared/contracts/task';
import type { CheckpointPort, DesktopPort, ModelPort } from './ports';
import type { MissionPlan, PhaseCheckpoint, PhaseRecord } from '../shared/contracts/mission';
import { MissionMemory } from './memory/mission-memory';
import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';
import { defaultGroundingEngine } from './vision/ui-grounding';
import type { UIGroundingEngine } from './vision/ui-grounding';
import { defaultPrismVerifier } from './vision/prism-verifier';
import { defaultErrorLoop } from './recovery/error-loop';
import type { ErrorLoop } from './recovery/error-loop';
import { createJournalEvent } from '../shared/contracts/journal';
import type { JournalOutcome, JournalSink, JournalStage } from '../shared/contracts/journal';

export interface ControllerDependencies {
  desktop: DesktopPort;
  model: ModelPort;
  grounding?: Pick<UIGroundingEngine, 'groundScreen'>;
  recovery?: Pick<ErrorLoop, 'decide' | 'story'>;
  checkpoints?: CheckpointPort;
  journal?: JournalSink;
  id: () => string;
  describe: (action: DesktopCommand) => string;
  validateAction: (action: unknown, observation: ScreenObservation) => DesktopCommand;
  changed: (snapshot: TaskSnapshot) => void;
  now?: () => number;
}

export function idleSnapshot(): TaskSnapshot {
  return {
    runId: null, revision: 0, status: 'idle', goal: '', maxSteps: 15, maxMinutes: 5, actions: [],
    messages: [], screenshot: null, pendingActionId: null, message: 'Ready for a test task.',
    awaitingCompletion: false, handoff: null, inputTokens: 0, outputTokens: 0,
    groundedElements: [],
    intent: null,
    mission: null,
  };
}

export class TaskController {
  private state = idleSnapshot();
  private operation: AbortController | null = null;
  private generation = 0;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private pending: { action: DesktopCommand; observation: ScreenObservation } | null = null;
  private now: () => number;
  private clarifications: string[] = [];
  private noProgressStreak = 0;
  private approvalMode: ApprovalMode = 'full_access';
  private mission: MissionMemory | null = null;
  private missionId: string | null = null;
  private pendingResume: string | null = null;
  private resumedHistory: string[] = [];
  private lastGuidance: string | null = null;
  private unmetStreak = 0;
  private unmetNote: string | null = null;

  constructor(private readonly dependencies: ControllerDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  getSnapshot(): TaskSnapshot {
    return { ...structuredClone(this.state), mission: this.mission?.getPlan() ?? null };
  }

  getMissionPlan(): MissionPlan | null {
    return this.mission?.getPlan() ?? null;
  }

  start(configuration: RunConfiguration): TaskSnapshot {
    if (this.isActive()) throw new Error('Stop the current run before starting another.');
    this.clearDeadline();
    this.pending = null;
    this.clarifications = [];
    this.resumedHistory = [];
    this.noProgressStreak = 0;
    this.lastGuidance = null;
    this.unmetStreak = 0;
    this.unmetNote = null;
    this.approvalMode = configuration.approvalMode ?? 'full_access';
    const runId = this.dependencies.id();
    if (configuration.resume) {
      // Mission resume: new run, same mission. Checkpoints load async in launch().
      this.missionId = configuration.resume.missionId;
      this.mission = null;
      this.pendingResume = configuration.resume.missionId;
      this.state = {
        ...idleSnapshot(), revision: this.state.revision, runId, goal: '', maxSteps: configuration.maxSteps,
        maxMinutes: configuration.maxMinutes, status: 'preparing', messages: [], message: 'Loading the saved mission.',
      };
    } else {
      this.missionId = runId;
      this.mission = new MissionMemory(runId, configuration.goal);
      this.pendingResume = null;
      this.state = {
        ...idleSnapshot(), revision: this.state.revision, runId, goal: configuration.goal,
        maxSteps: configuration.maxSteps, maxMinutes: configuration.maxMinutes, status: 'preparing',
        messages: [{ id: this.dependencies.id(), sender: 'user', content: configuration.goal, timestamp: this.timestamp() }],
        message: 'Checking desktop and model access.',
      };
    }
    this.deadline = setTimeout(
      () => this.fail('The ' + configuration.maxMinutes + '-minute run limit was reached.'),
      configuration.maxMinutes * 60_000,
    );
    this.publish();
    this.record('mission', 'info', configuration.resume ? 'Run started (resuming mission).' : 'Run started.');
    this.launch();
    return this.getSnapshot();
  }

  pause(runId: string): TaskSnapshot {
    this.assertRun(runId);
    if (this.state.status === 'paused' || !this.isActive()) return this.getSnapshot();
    this.markInterruptedInput();
    this.cancelOperation();
    this.invalidatePending('pending');
    this.update({ status: 'paused', message: 'Paused. No new screen captures or actions until you resume.', awaitingCompletion: false, handoff: null, screenshot: null });
    return this.getSnapshot();
  }

  takeOver(runId: string): TaskSnapshot {
    this.assertRun(runId);
    if (!this.isActive()) throw new Error('There is no active task to take over.');
    this.yieldToUser({ kind: 'manual', reason: 'You have control of the desktop. Finish your step, then return control to Ghost Agent.' });
    return this.getSnapshot();
  }

  resume(runId: string, answer?: string): TaskSnapshot {
    this.assertRun(runId);
    if (!['paused', 'needs_user'].includes(this.state.status)) throw new Error('Only a paused task can resume.');
    if (this.state.handoff?.kind === 'clarification') {
      if (typeof answer !== 'string' || !answer.trim() || answer.length > 1000 || answer.includes('\0')) throw new Error('Answer the clarification before resuming.');
      if (this.clarifications.length >= 5) throw new Error('Start a new task with the clarified goal after five questions.');
      this.clarifications.push(answer.trim());
      this.state = { ...this.state, messages: [...this.state.messages,
        { id: this.dependencies.id(), sender: 'user', content: 'Clarification: ' + answer.trim(), timestamp: this.timestamp() }] };
    } else if (answer !== undefined && answer !== '') throw new Error('This task is not asking for a text clarification.');
    this.noProgressStreak = 0;
    this.update({ status: 'observing', handoff: null, screenshot: null, message: 'Resuming from a fresh screen observation.' });
    this.launch();
    return this.getSnapshot();
  }

  stop(runId: string): TaskSnapshot {
    this.assertRun(runId);
    if (!this.isActive()) return this.getSnapshot();
    this.markInterruptedInput();
    this.cancelOperation();
    this.clearDeadline();
    this.invalidatePending('rejected');
    this.update({ status: 'stopped', message: 'Stopped. Already submitted input cannot be undone.', awaitingCompletion: false, handoff: null });
    this.record('terminal', 'info', 'Stopped by user. Already submitted input cannot be undone.');
    this.persistPhase();
    return this.getSnapshot();
  }

  review(runId: string, actionId: string, approve: boolean): TaskSnapshot {
    this.assertRun(runId);
    if (this.state.status !== 'awaiting_approval' || this.state.pendingActionId !== actionId || !this.pending) {
      throw new Error('This action is no longer awaiting approval.');
    }
    if (!approve) {
      this.invalidatePending('rejected');
      this.stop(runId);
      return this.getSnapshot();
    }
    if (this.now() - this.pending.observation.capturedAt > 30_000) {
      this.invalidatePending('rejected');
      this.update({ status: 'observing', message: 'The observation expired. A new decision and approval are required.' });
      this.launch();
      return this.getSnapshot();
    }

    const pending = this.pending;
    this.pending = null;
    this.update({
      status: 'acting', pendingActionId: null, message: this.dependencies.describe(pending.action),
      actions: this.state.actions.map(action => action.id === actionId ? { ...action, status: 'pending' } : action),
    });
    this.launch(pending);
    return this.getSnapshot();
  }

  confirm(runId: string, verified: boolean): TaskSnapshot {
    this.assertRun(runId);
    if (!this.state.awaitingCompletion || this.state.status !== 'verifying') throw new Error('No result is awaiting your check.');
    this.cancelOperation();
    this.clearDeadline();
    this.update({
      status: verified ? 'completed' : 'failed', awaitingCompletion: false,
      message: verified ? 'Completion confirmed by you against the final screen.' : 'The result was marked incomplete.',
    });
    this.record('terminal', verified ? 'success' : 'failure',
      verified ? 'Completion confirmed against the final screen.' : 'The result was marked incomplete.');
    this.closePhase(verified);
    return this.getSnapshot();
  }

  dispose(): void {
    this.cancelOperation();
    this.clearDeadline();
  }

  private launch(execution?: { action: DesktopCommand; observation: ScreenObservation }): void {
    this.cancelOperation();
    const controller = new AbortController();
    this.operation = controller;
    const generation = this.generation;
    void this.advance(controller.signal, generation, execution).catch(() => {
      if (this.current(generation, controller.signal)) this.fail('The task could not continue.');
    });
  }

  private async advance(signal: AbortSignal, generation: number, execution?: { action: DesktopCommand; observation: ScreenObservation }): Promise<void> {
    try {
      if (this.pendingResume && !this.mission) {
        const ready = await this.ensureResumed(signal, generation);
        if (!ready || !this.current(generation, signal)) return;
      }
      if (!this.state.intent) {
        const ready = await this.ensureIntent(signal, generation);
        if (!ready || !this.current(generation, signal)) return;
      }
      await this.dependencies.desktop.preflight(signal);
      if (!this.current(generation, signal)) return;
      if (execution) {
        await this.dependencies.desktop.execute(execution.action, execution.observation, signal);
        if (!this.current(generation, signal)) return;
      }

      this.update({ status: 'observing', message: 'Capturing the selected test desktop.' });
      const observation = await this.dependencies.desktop.capture(signal);
      if (!this.current(generation, signal)) return;

      let progressNote: string | null = null;
      if (execution) {
        const delta = defaultPrismVerifier.verifyTransition(execution.observation, observation, execution.action);
        let verification = delta;
        let progressed = delta.status !== 'stalled_no_change';
        let typeDetail: string | null = null;
        if (execution.action.type === 'type') {
          const check = await this.dependencies.model.verifyText({ text: execution.action.text, observation, signal });
          if (!this.current(generation, signal)) return;
          const verifyInputTokens = this.state.inputTokens + check.inputTokens;
          const verifyOutputTokens = this.state.outputTokens + check.outputTokens;
          this.state = { ...this.state, inputTokens: verifyInputTokens, outputTokens: verifyOutputTokens };
          if (verifyInputTokens > 60_000 || verifyOutputTokens > 8_000) {
            this.fail('The run token allowance was reached. No further actions will be dispatched.');
            return;
          }
          if (check.confirmed) {
            progressed = true;
            verification = { ...delta, status: 'verified_success', summary: 'PRISM: typed value confirmed on screen (+' + delta.visualDeltaPercent + '% screen delta).', verifiedAt: Date.now() };
          } else {
            progressed = false;
            typeDetail = check.detail;
            verification = { status: 'human_intervention_needed', visualDeltaPercent: delta.visualDeltaPercent, summary: 'PRISM: typed value not visible on screen.', recoverySuggestion: check.detail, verifiedAt: Date.now() };
          }
        }
        const last = this.state.actions.at(-1);
        this.state = {
          ...this.state,
          actions: this.state.actions.map(action => action.id === last?.id ? { ...action, status: 'executed', verification } : action),
        };
        this.unmetStreak = 0;
        this.record('verify', verification.status === 'verified_success' ? 'success' : verification.status === 'stalled_no_change' ? 'stalled' : 'failure',
          verification.summary, { stepId: last?.id ?? null });
        this.persistPhase();
        if (progressed) {
          this.noProgressStreak = 0;
          this.lastGuidance = null;
        } else {
          const recovery = (this.dependencies.recovery ?? defaultErrorLoop).decide({
            action: execution.action,
            verificationSummary: verification.summary,
            typeDetail,
            streak: this.noProgressStreak,
            phase: this.phaseContext(),
            recentAttempts: this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
              .map(action => action.status + ': ' + action.description),
            priorGuidance: this.lastGuidance,
          });
          if (recovery.kind === 'retry') {
            this.noProgressStreak += 1;
            this.lastGuidance = recovery.guidance;
            progressNote = recovery.guidance;
          } else {
            this.record('stall', 'stalled', recovery.reason.slice(0, 200));
            this.yieldToUser({ kind: 'manual', reason: recovery.reason });
            return;
          }
        }
      }
      const engine = this.dependencies.grounding ?? defaultGroundingEngine;
      const grounding = engine.groundScreen(observation);
      this.update({
        status: 'thinking',
        screenshot: observation.image,
        message: grounding.elements.length
          ? 'Grounded ' + grounding.totalElements + ' interactive elements. Asking Meta for the next step.'
          : 'Asking Meta for the next step from the fresh screenshot.',
        groundedElements: grounding.elements,
      });
      const history = [...this.resumedHistory];
      history.push(...this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
        .map(action => action.status + ': ' + action.description));
      history.push(...this.clarifications.map(answer => 'User clarification: ' + answer));
      const lastVerification = this.state.actions.at(-1)?.verification;
      if (lastVerification) history.push('Last step result: ' + lastVerification.summary);
      if (progressNote) history.push(progressNote);
      if (this.unmetNote) {
        history.push(this.unmetNote);
        this.unmetNote = null;
      }
      const phase = this.mission?.currentPhase();
      if (phase) {
        history.unshift(...phase.notes.slice(-8).map(note => 'Phase note: ' + note));
        if (phase.steps.length) {
          history.unshift('Planned steps: ' + phase.steps.map((step, index) => (index + 1) + ') ' + step.slice(0, 120)).join('; ').slice(0, 1500));
        }
        if (phase.success) history.unshift('Phase done when: ' + phase.success);
        history.unshift('Current phase [' + phase.domain + ']: ' + phase.goal);
      }
      const decision = await this.dependencies.model.decide({
        goal: this.state.goal, observation, history, signal,
        ...(grounding.elements.length ? { grounding } : {}),
      });
      if (!this.current(generation, signal)) return;
      const inputTokens = this.state.inputTokens + decision.inputTokens;
      const outputTokens = this.state.outputTokens + decision.outputTokens;
      this.state = { ...this.state, inputTokens, outputTokens };
      if (inputTokens > 60_000 || outputTokens > 8_000) {
        this.fail('The run token allowance was reached. No further actions will be dispatched.');
        return;
      }
      if (decision.handoff) {
        this.yieldToUser(decision.handoff);
        return;
      }
      if (!decision.action) {
        const confirmed = await this.confirmPhaseSuccess(observation, signal, generation);
        if (!confirmed || !this.current(generation, signal)) return;
        if (this.advancePhase(decision.message)) {
          this.update({ status: 'observing', message: 'Phase complete. Moving to the next phase from a fresh screen observation.' });
          this.launch();
          return;
        }
        const finalObservation = await this.dependencies.desktop.capture(signal);
        if (!this.current(generation, signal)) return;
        this.update({
          status: 'verifying', awaitingCompletion: true, screenshot: finalObservation.image,
          message: 'The model stopped. Check the final screen and confirm whether your goal is complete.',
          messages: [...this.state.messages, { id: this.dependencies.id(), sender: 'agent', content: decision.message || 'Review the final screen.', timestamp: this.timestamp() }],
        });
        return;
      }

      const action = this.dependencies.validateAction(decision.action, observation);
      if (this.state.actions.filter(item => item.status === 'executed').length >= this.state.maxSteps) {
        this.fail('The action limit was reached. No further input will be dispatched.');
        return;
      }
      const id = this.dependencies.id();
      const isAuto = this.approvalMode === 'full_access' || this.approvalMode === 'approve_for_me';
      const view: AgentAction = {
        id, type: action.type === 'keypress' ? 'key_press' : action.type === 'screenshot' ? 'verify' : action.type,
        description: this.dependencies.describe(action), timestamp: this.timestamp(),
        status: isAuto ? 'pending' : 'awaiting_approval',
        ...('x' in action ? { coordinates: { x: action.x, y: action.y } } : {}),
        ...('text' in action ? { text: action.text } : {}),
      };

      if (isAuto) {
        this.pending = null;
        this.update({
          status: 'acting', pendingActionId: null, message: this.dependencies.describe(action),
          actions: [...this.state.actions.filter(item => item.status !== 'pending'), view],
        });
        this.launch({ action, observation });
        return;
      }

      this.pending = { action, observation };
      this.update({
        status: 'awaiting_approval', pendingActionId: id,
        message: decision.warnings.length ? decision.warnings.join(' · ') : 'Review this action before it is executed.',
        actions: [...this.state.actions.filter(item => item.status !== 'pending'), view],
      });
    } catch (error) {
      if (this.current(generation, signal)) {
        this.fail(error instanceof Error ? error.message : 'The task could not continue.');
      }
    }
  }

  private async ensureIntent(signal: AbortSignal, generation: number): Promise<boolean> {
    this.update({ status: 'preparing', message: 'Understanding your goal before touching the desktop.' });
    const decision = await this.dependencies.model.parseIntent({
      goal: this.state.goal, clarifications: [...this.clarifications], signal,
    });
    if (!this.current(generation, signal)) return false;
    const inputTokens = this.state.inputTokens + decision.inputTokens;
    const outputTokens = this.state.outputTokens + decision.outputTokens;
    this.state = { ...this.state, inputTokens, outputTokens };
    if (inputTokens > 60_000 || outputTokens > 8_000) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return false;
    }
    if (decision.intent.missing.length) {
      const first = decision.intent.questions?.[0];
      const options = first?.options.filter(option => option.trim()).slice(0, 4) ?? [];
      this.yieldToUser({
        kind: 'clarification',
        reason: (first && first.question.trim()
          ? first.question
          : 'Before I touch the desktop, I need: ' + decision.intent.missing.join(', ') + '. Reply with the missing values.').slice(0, 1000),
        ...(first && first.question.trim() && options.length
          ? { questions: [{ id: first.id.slice(0, 32), question: first.question.slice(0, 300), options: options.map(option => option.slice(0, 100)) }] }
          : {}),
      });
      return false;
    }
    const params = Object.entries(decision.intent.params).map(([name, value]) => name + '=' + value).join(', ');
    this.state = {
      ...this.state, intent: decision.intent,
      messages: [...this.state.messages, {
        id: this.dependencies.id(), sender: 'agent',
        content: ('Understood: ' + decision.intent.summary + (params ? ' Params: ' + params : '')).slice(0, 1500),
        timestamp: this.timestamp(),
      }],
    };
    this.record('intent', 'success', 'Understood: ' + decision.intent.summary);
    const planned = await this.ensurePlan(signal, generation);
    if (!planned || !this.current(generation, signal)) return false;
    return true;
  }

  private async ensurePlan(signal: AbortSignal, generation: number): Promise<boolean> {
    const mission = this.mission;
    if (!mission) {
      this.fail('The mission plan is missing. Start a new task.');
      return false;
    }
    if (mission.getPlan().phases.length) return true;
    this.update({ status: 'preparing', message: 'Splitting your goal into phases.' });
    const decision = await this.dependencies.model.plan({ goal: this.state.goal, signal });
    if (!this.current(generation, signal)) return false;
    const inputTokens = this.state.inputTokens + decision.inputTokens;
    const outputTokens = this.state.outputTokens + decision.outputTokens;
    this.state = { ...this.state, inputTokens, outputTokens };
    if (inputTokens > 60_000 || outputTokens > 8_000) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return false;
    }
    try {
      for (const phase of decision.phases) mission.addPhase(phase.domain, phase.goal, { steps: phase.steps, success: phase.success });
      const first = mission.getPlan().phases[0];
      if (!first) throw new Error('The plan came back empty.');
      mission.startPhase(first.phaseId);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'The mission plan is invalid.');
      return false;
    }
    this.record('mission', 'info', 'Mission planned: ' + decision.phases.length + ' phase(s).');
    void this.dependencies.checkpoints?.saveMission({ missionId: this.missionId!, goal: this.state.goal, createdAt: Date.now() })
      .catch(() => undefined);
    this.persistPhase();
    return true;
  }

  private async ensureResumed(signal: AbortSignal, generation: number): Promise<boolean> {
    const missionId = this.pendingResume;
    const store = this.dependencies.checkpoints;
    this.update({ status: 'preparing', message: 'Loading the saved mission.' });
    if (!missionId || !store) {
      this.fail('Mission checkpoints are unavailable, so this mission cannot resume.');
      return false;
    }
    const [meta, checkpoints] = await Promise.all([store.loadMission(missionId), store.list(missionId)]);
    if (!this.current(generation, signal)) return false;
    if (!meta || !checkpoints.length) {
      this.fail('No saved mission was found. Start a new task instead.');
      return false;
    }
    let mission: MissionMemory;
    try {
      mission = MissionMemory.restore({
        missionId: meta.missionId, goal: meta.goal, createdAt: meta.createdAt,
        phases: checkpoints.map(item => ({
          phaseId: item.phaseId, domain: item.domain, goal: item.goal, status: item.status,
          notes: [...item.notes], steps: [...item.steps], success: item.success,
          startedAt: null, finishedAt: null,
        })),
      });
    } catch {
      this.fail('The saved mission is damaged and cannot resume. Start a new task instead.');
      return false;
    }
    const failed = mission.getPlan().phases.find(phase => phase.status === 'failed') ?? null;
    const active = mission.currentPhase();
    let resumed: PhaseCheckpoint | undefined;
    try {
      if (failed) {
        mission.reactivatePhase(failed.phaseId);
        resumed = checkpoints.find(item => item.phaseId === failed.phaseId);
      } else if (active) {
        resumed = checkpoints.find(item => item.phaseId === active.phaseId);
      } else {
        this.fail('This mission is already complete.');
        return false;
      }
      if (!resumed) throw new Error('The resumed phase has no checkpoint.');
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'The saved mission cannot resume.');
      return false;
    }
    this.mission = mission;
    this.pendingResume = null;
    this.clarifications = [...resumed.clarifications];
    this.noProgressStreak = resumed.noProgressStreak;
    this.resumedHistory = [...resumed.executedDescs,
      ...(resumed.lastVerification ? ['Last step result: ' + resumed.lastVerification] : [])];
    this.state = {
      ...this.state, goal: meta.goal, intent: resumed.intent,
      messages: [{ id: this.dependencies.id(), sender: 'user', content: meta.goal, timestamp: this.timestamp() }],
      inputTokens: resumed.inputTokens, outputTokens: resumed.outputTokens,
      message: 'Mission resumed. Continuing from the saved phase.',
    };
    this.record('mission', 'info', 'Mission resumed at phase ' + resumed.phaseId + '.');
    return true;
  }

  /**
   * Verifies the active phase's success condition from the screen before it may
   * close. True closes the phase; false either relaunches the loop with a
   * continue-working note or escalates after repeated unmet stops.
   */
  private async confirmPhaseSuccess(observation: ScreenObservation, signal: AbortSignal, generation: number): Promise<boolean> {
    const phase = this.mission?.currentPhase();
    if (!phase?.success) return true;
    const check = await this.dependencies.model.verifySuccess({ condition: phase.success, observation, signal });
    if (!this.current(generation, signal)) return false;
    const inputTokens = this.state.inputTokens + check.inputTokens;
    const outputTokens = this.state.outputTokens + check.outputTokens;
    this.state = { ...this.state, inputTokens, outputTokens };
    if (inputTokens > 60_000 || outputTokens > 8_000) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return false;
    }
    if (check.confirmed) {
      this.unmetStreak = 0;
      this.record('verify', 'success', 'Phase success confirmed: ' + phase.success);
      return true;
    }
    this.record('verify', 'failure', 'Phase success not met: ' + check.detail);
    if (++this.unmetStreak >= 2) {
      const recovery = this.dependencies.recovery ?? defaultErrorLoop;
      this.yieldToUser({ kind: 'manual', reason: recovery.story({
        phase: this.phaseContext(),
        recentAttempts: this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
          .map(action => action.status + ': ' + action.description),
        verificationSummary: 'Phase success not met: ' + check.detail,
        priorGuidance: this.lastGuidance,
      }) });
      return false;
    }
    this.unmetNote = 'Phase success not met (' + check.detail.slice(0, 200) + '). The phase is not done - keep working towards: ' + phase.success;
    this.update({ status: 'observing', message: 'Phase success not confirmed. Continuing the phase from a fresh screen observation.' });
    this.launch();
    return false;
  }

  /** Completes the active phase and starts the next one. False when the mission itself is done. */
  private advancePhase(message: string): boolean {
    const mission = this.mission;
    const current = mission?.currentPhase();
    const next = mission?.nextPending();
    if (!mission || !current || !next) return false;
    try {
      const done = mission.completePhase(current.phaseId, message.trim() ? message.slice(0, 500) : undefined);
      this.persistPhase(done);
      mission.startPhase(next.phaseId);
      this.persistPhase();
      this.record('mission', 'info', 'Phase complete: [' + done.domain + '] ' + done.goal);
      return true;
    } catch {
      return false;
    }
  }

  /** Best-effort durable snapshot of the active phase. Never throws. */
  private persistPhase(record?: PhaseRecord): void {
    try {
      const store = this.dependencies.checkpoints;
      const mission = this.mission;
      const missionId = this.missionId;
      const phase = record ?? mission?.currentPhase();
      if (!store || !mission || !missionId || !phase) return;
      const plan = mission.getPlan();
      const checkpoint: PhaseCheckpoint = {
        missionId, phaseId: phase.phaseId,
        order: Math.max(0, plan.phases.findIndex(item => item.phaseId === phase.phaseId)),
        domain: phase.domain, goal: phase.goal, status: phase.status, notes: [...phase.notes],
        steps: [...phase.steps], success: phase.success,
        intent: this.state.intent ? { ...this.state.intent, params: { ...this.state.intent.params }, missing: [...this.state.intent.missing] } : null,
        clarifications: [...this.clarifications],
        executedDescs: [...this.resumedHistory,
          ...this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
            .map(action => action.status + ': ' + action.description)].slice(-60),
        lastVerification: this.state.actions.at(-1)?.verification?.summary ?? this.resumedHistory.at(-1) ?? null,
        inputTokens: this.state.inputTokens, outputTokens: this.state.outputTokens,
        noProgressStreak: this.noProgressStreak, savedAt: Date.now(),
      };
      void store.save(checkpoint).catch(() => undefined);
    } catch {
      // Checkpoints are best-effort; the live run continues without them.
    }
  }

  private isActive(): boolean {
    return !['idle', 'completed', 'stopped', 'failed'].includes(this.state.status);
  }

  private yieldToUser(handoff: UserHandoff): void {
    this.markInterruptedInput();
    this.cancelOperation();
    this.invalidatePending('rejected');
    this.update({ status: 'needs_user', handoff, screenshot: null, awaitingCompletion: false, message: handoff.reason });
    this.record('handoff', 'handoff', handoff.kind + ': ' + handoff.reason);
    this.persistPhase();
  }

  /** Domain-scoped phase context for recovery stories. Never throws. */
  private phaseContext(): import('../shared/contracts/mission').PhaseContext | null {
    try {
      const current = this.mission?.currentPhase();
      return current && this.mission ? this.mission.getPhaseContext(current.phaseId) : null;
    } catch {
      return null;
    }
  }

  private assertRun(runId: string): void {
    if (runId !== this.state.runId) throw new Error('This task is no longer current.');
  }

  private current(generation: number, signal: AbortSignal): boolean {
    return generation === this.generation && !signal.aborted && this.isActive() && !['paused', 'needs_user'].includes(this.state.status);
  }

  private cancelOperation(): void {
    this.generation += 1;
    this.operation?.abort();
    this.operation = null;
  }

  private invalidatePending(status: AgentAction['status']): void {
    const pendingId = this.state.pendingActionId;
    this.pending = null;
    this.state = { ...this.state, pendingActionId: null, actions: this.state.actions.map(action => action.id === pendingId ? { ...action, status } : action) };
  }

  private fail(message: string): void {
    if (!this.isActive()) return;
    this.markInterruptedInput();
    this.cancelOperation();
    this.clearDeadline();
    this.invalidatePending('failed');
    this.update({ status: 'failed', message, awaitingCompletion: false, handoff: null });
    this.record('terminal', 'failure', message);
    const current = this.mission?.currentPhase();
    if (current && this.mission) {
      try {
        this.persistPhase(this.mission.failPhase(current.phaseId, message.slice(0, 400)));
      } catch {
        // Phase bookkeeping must not break the failure path.
      }
    }
  }

  /** Settles the active phase from the user's completion verdict. Never throws. */
  private closePhase(verified: boolean): void {
    const current = this.mission?.currentPhase();
    if (!current || !this.mission) return;
    try {
      this.persistPhase(verified
        ? this.mission.completePhase(current.phaseId, 'Confirmed by user against the final screen.')
        : this.mission.failPhase(current.phaseId, 'The result was marked incomplete.'));
    } catch {
      // Phase bookkeeping must not break the terminal path.
    }
  }

  private clearDeadline(): void {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }

  private markInterruptedInput(): void {
    if (this.state.status !== 'acting') return;
    this.state = {
      ...this.state,
      actions: this.state.actions.map(action => action.status === 'pending'
        ? { ...action, status: 'failed', description: action.description + ' (interrupted; inspect the desktop before retrying)' }
        : action),
    };
  }

  private timestamp(): string {
    return new Date(this.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private update(patch: Partial<TaskSnapshot>): void {
    this.state = { ...this.state, ...patch };
    this.publish();
  }

  private publish(): void {
    this.state = { ...this.state, revision: this.state.revision + 1 };
    this.dependencies.changed(this.getSnapshot());
  }

  /** Best-effort journal event. Never throws; journaling must not break runs. */
  private record(stage: JournalStage, outcome: JournalOutcome, summary: string, extra?: { stepId?: string | null }): void {
    const journal = this.dependencies.journal;
    const runId = this.state.runId;
    if (!journal || !runId) return;
    try {
      journal.append(createJournalEvent({
        missionId: this.missionId ?? runId, runId,
        phaseId: this.mission?.currentPhase()?.phaseId ?? null, stepId: extra?.stepId ?? null,
        stage, outcome, summary,
        inputTokens: this.state.inputTokens, outputTokens: this.state.outputTokens,
      }));
    } catch {
      // Journaling must never break the agent loop.
    }
  }
}
