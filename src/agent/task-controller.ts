import type { AgentAction, ApprovalMode, RunConfiguration, TaskSnapshot, UserHandoff } from '../shared/contracts/task';
import type { CheckpointPort, DesktopPort, ModelPort, ShellPort } from './ports';
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

/** One blind execution unit: actions run back-to-back from a single screenshot, then verified once. */
interface BatchExecution {
  actions: DesktopCommand[];
  actionIds: string[];
  observation: ScreenObservation;
}

export interface ControllerDependencies {
  desktop: DesktopPort;
  model: ModelPort;
  grounding?: Pick<UIGroundingEngine, 'groundScreen'>;
  recovery?: Pick<ErrorLoop, 'decide' | 'story'>;
  checkpoints?: CheckpointPort;
  journal?: JournalSink;
  /** Terminal executor for run_shell steps. Absent in tests and minimal hosts. */
  shell?: ShellPort;
  id: () => string;
  describe: (action: DesktopCommand) => string;
  validateAction: (action: unknown, observation: ScreenObservation) => DesktopCommand;
  validateShell: (command: string) => string;
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
  /** Terminal command awaiting approval. Never set together with pending. */
  private pendingShell: string | null = null;
  /** Consecutive failed shell commands. Three in a row hands control to the user. */
  private shellFailures = 0;
  /** Last seen foreground window, narrated to the model so it knows where it is. */
  private lastWindowId: string | null = null;
  private lastWindowTitle: string | null = null;
  /** Recent focus transitions (IDs only) for decide() history. Never journaled. */
  private focusChanges: string[] = [];
  private now: () => number;
  private clarifications: string[] = [];
  private noProgressStreak = 0;
  /** Consecutive stall handoffs without progress. Survives resume so a stuck run fails instead of looping forever. */
  private stallCycles = 0;
  /** Think-time of the latest decide(), paired with the next verification for timing. */
  private lastDecideMs = 0;
  private approvalMode: ApprovalMode = 'full_access';
  private mission: MissionMemory | null = null;
  private missionId: string | null = null;
  private pendingResume: string | null = null;
  private pendingResumeNote: string | null = null;
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
    this.stallCycles = 0;
    this.lastDecideMs = 0;
    this.pendingShell = null;
    this.shellFailures = 0;
    this.lastWindowId = null;
    this.lastWindowTitle = null;
    this.focusChanges = [];
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
      this.pendingResumeNote = configuration.resume.note ?? null;
      this.state = {
        ...idleSnapshot(), revision: this.state.revision, runId, goal: '', maxSteps: configuration.maxSteps,
        maxMinutes: configuration.maxMinutes, status: 'preparing', messages: [], message: 'Loading the saved mission.',
      };
    } else {
      this.missionId = runId;
      this.mission = new MissionMemory(runId, configuration.goal);
      this.pendingResume = null;
      this.pendingResumeNote = null;
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
    if (this.state.status !== 'awaiting_approval' || this.state.pendingActionId !== actionId || (!this.pending && !this.pendingShell)) {
      throw new Error('This action is no longer awaiting approval.');
    }
    if (!approve) {
      this.invalidatePending('rejected');
      this.stop(runId);
      return this.getSnapshot();
    }
    const desktop = this.pending;
    if (this.pendingShell) {
      const command = this.pendingShell;
      this.pendingShell = null;
      this.update({
        status: 'acting', pendingActionId: null, message: ('$ ' + command).slice(0, 300),
        actions: this.state.actions.map(action => action.id === actionId ? { ...action, status: 'pending' } : action),
      });
      this.launchShell(command, actionId);
      return this.getSnapshot();
    }
    if (!desktop || this.now() - desktop.observation.capturedAt > 30_000) {
      this.invalidatePending('rejected');
      this.update({ status: 'observing', message: 'The observation expired. A new decision and approval are required.' });
      this.launch();
      return this.getSnapshot();
    }

    const pending = desktop;
    this.pending = null;
    this.update({
      status: 'acting', pendingActionId: null, message: this.dependencies.describe(pending.action),
      actions: this.state.actions.map(action => action.id === actionId ? { ...action, status: 'pending' } : action),
    });
    this.launch({ actions: [pending.action], actionIds: [actionId], observation: pending.observation });
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

  private launch(execution?: BatchExecution): void {
    this.cancelOperation();
    const controller = new AbortController();
    this.operation = controller;
    const generation = this.generation;
    void this.advance(controller.signal, generation, execution).catch(() => {
      if (this.current(generation, controller.signal)) this.fail('The task could not continue.');
    });
  }

  private async advance(signal: AbortSignal, generation: number, execution?: BatchExecution): Promise<void> {
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
      let failedActionId: string | null = null;
      let executionError: string | null = null;
      if (execution) {
        for (let index = 0; index < execution.actions.length; index++) {
          try {
            await this.dependencies.desktop.execute(execution.actions[index]!, execution.observation, signal);
          } catch (error) {
            if (!this.current(generation, signal)) return;
            failedActionId = execution.actionIds[index] ?? null;
            executionError = error instanceof Error ? error.message : String(error);
            break;
          }
          if (!this.current(generation, signal)) return;
        }
      }

      this.update({ status: 'observing', message: 'Capturing the selected test desktop.' });
      const captureStart = this.now();
      const observation = await this.dependencies.desktop.capture(signal);
      if (!this.current(generation, signal)) return;
      const captureMs = this.now() - captureStart;
      this.noteWindowFocus(observation);

      let progressNote: string | null = null;
      if (execution) {
        // A trailing wait/screenshot must not mask a stalled click or type: judge the batch by its last meaningful action.
        const probe = [...execution.actions].reverse().find(item => item.type !== 'wait' && item.type !== 'screenshot') ?? execution.actions[0]!;
        const delta = defaultPrismVerifier.verifyTransition(execution.observation, observation, probe);
        let verification = delta;
        let progressed = delta.status !== 'stalled_no_change';
        let typeDetail: string | null = null;
        let verifyMs = 0;
        const typed = execution.actions.filter((item): item is Extract<DesktopCommand, { type: 'type' }> => item.type === 'type');
        if (typed.length && delta.status === 'verified_success') {
          // The screen already shows typed output: skip the paid re-check.
          progressed = true;
          verification = { ...delta, summary: 'PRISM: typed value visible on screen (+' + delta.visualDeltaPercent + '% delta); paid re-check skipped.' };
        } else if (typed.length) {
          const verifyStart = this.now();
          const check = await this.dependencies.model.verifyText({ text: typed.map(item => item.text).join('\n'), observation, signal });
          verifyMs = this.now() - verifyStart;
          if (!this.current(generation, signal)) return;
          const verifyInputTokens = this.state.inputTokens + check.inputTokens;
          const verifyOutputTokens = this.state.outputTokens + check.outputTokens;
          this.state = { ...this.state, inputTokens: verifyInputTokens, outputTokens: verifyOutputTokens };
          const verifyBudget = this.tokenBudget();
          if (verifyInputTokens > verifyBudget.input || verifyOutputTokens > verifyBudget.output) {
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
        if (executionError) {
          // Input itself failed, so no screen change is expected: feed the
          // standard stall path so the run retries instead of dying outright.
          progressed = false;
          verification = {
            status: 'stalled_no_change', visualDeltaPercent: delta.visualDeltaPercent,
            summary: 'Desktop input failed: ' + executionError.slice(0, 300) + '. The screen is unchanged; retry differently or work around it.',
            verifiedAt: Date.now(),
          };
        }
        verification = { ...verification, summary: this.withTiming(verification.summary, captureMs + verifyMs) };
        const batchIds = new Set(execution.actionIds);
        const failedAt = failedActionId ? execution.actionIds.indexOf(failedActionId) : 0;
        this.state = {
          ...this.state,
          actions: this.state.actions.map(action => {
            if (!batchIds.has(action.id)) return action;
            if (executionError === null) return { ...action, status: 'executed', verification };
            const position = execution.actionIds.indexOf(action.id);
            if (position >= 0 && position < failedAt) return { ...action, status: 'executed', verification };
            if (position === failedAt) return { ...action, status: 'failed', verification };
            return { ...action, status: 'failed', verification: { ...verification, summary: 'Skipped: earlier batch input failed.' } };
          }),
        };
        this.unmetStreak = 0;
        this.record('verify', verification.status === 'verified_success' ? 'success' : verification.status === 'stalled_no_change' ? 'stalled' : 'failure',
          verification.summary, { stepId: execution.actionIds.at(-1) ?? null, durationMs: captureMs + verifyMs });
        this.persistPhase();
        if (progressed) {
          this.noProgressStreak = 0;
          this.stallCycles = 0;
          this.lastGuidance = null;
        } else {
          const recovery = (this.dependencies.recovery ?? defaultErrorLoop).decide({
            action: execution.actions.at(-1)!,
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
            if (this.cappedStall(recovery.reason)) return;
            this.record('stall', 'stalled', recovery.reason.slice(0, 200));
            this.yieldToUser({ kind: 'manual', reason: recovery.reason });
            return;
          }
        }
      }
      await this.decideNext(signal, generation, observation, progressNote);
    } catch (error) {
      if (this.current(generation, signal)) {
        this.fail(error instanceof Error ? error.message : 'The task could not continue.');
      }
    }
  }

  /**
   * Decides the next step from history. With a screenshot this is the normal
   * visual loop; with null (after a terminal command) the model decides from
   * text output alone and no screenshot is taken unless it asks for the screen.
   */
  private async decideNext(signal: AbortSignal, generation: number, observation: ScreenObservation | null, progressNote: string | null): Promise<void> {
    const engine = this.dependencies.grounding ?? defaultGroundingEngine;
    const grounding = observation ? engine.groundScreen(observation) : null;
    this.update({
      status: 'thinking',
      ...(observation ? { screenshot: observation.image } : {}),
      message: grounding?.elements.length
        ? 'Grounded ' + grounding.totalElements + ' interactive elements. Asking Meta for the next step.'
        : observation
          ? 'Asking Meta for the next step from the fresh screenshot.'
          : 'Asking Meta for the next step from the terminal output.',
      groundedElements: grounding?.elements ?? [],
    });
    const history = [...this.resumedHistory];
    history.push(...this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
      .map(action => action.status + ': ' + action.description));
    history.push(...this.clarifications.map(answer => 'User clarification: ' + answer));
    const lastVerification = this.state.actions.at(-1)?.verification;
    if (lastVerification) history.push('Last step result: ' + lastVerification.summary);
    history.push(...this.focusChanges.slice(-3));
    if (this.lastWindowId) {
      history.push('Focused window: #' + this.lastWindowId + (this.lastWindowTitle ? ' (' + this.lastWindowTitle + ')' : ''));
    }
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
    const decideStart = this.now();
    const decision = await this.dependencies.model.decide({
      goal: this.state.goal, history, signal,
      ...(observation ? { observation } : {}),
      ...(grounding?.elements.length ? { grounding } : {}),
    });
    if (!this.current(generation, signal)) return;
    this.lastDecideMs = this.now() - decideStart;
    this.noteStepTag(decision.message);
    const inputTokens = this.state.inputTokens + decision.inputTokens;
    const outputTokens = this.state.outputTokens + decision.outputTokens;
    this.state = { ...this.state, inputTokens, outputTokens };
    const budget = this.tokenBudget();
    if (inputTokens > budget.input || outputTokens > budget.output) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return;
    }
    if (decision.handoff) {
      this.yieldToUser(decision.handoff);
      return;
    }
    if (decision.shell) {
      await this.shellTurn(signal, generation, decision.shell.command, decision.warnings);
      return;
    }
    const batch = decision.actions?.length ? decision.actions : decision.action ? [decision.action] : [];
    const pending = decision.pendingActions ?? [];
    if (!batch.length && !pending.length) {
      const finishFrame = observation ?? await this.freshCapture(signal, generation);
      if (!finishFrame || !this.current(generation, signal)) return;
      const confirmed = await this.confirmPhaseSuccess(finishFrame, signal, generation);
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

    const frame = observation ?? await this.freshCapture(signal, generation);
    if (!frame || !this.current(generation, signal)) return;
    let planned: DesktopCommand[];
    if (batch.length) {
      planned = batch.map(item => this.dependencies.validateAction(item, frame));
    } else {
      try {
        planned = pending.slice(0, 5).map(item => this.dependencies.validateAction(item, frame));
      } catch {
        this.fail('Meta returned an action outside the fresh screenshot. No input was dispatched.');
        return;
      }
    }
    const room = this.state.maxSteps - this.state.actions.filter(item => item.status === 'executed').length;
    if (room <= 0) {
      this.fail('The action limit was reached. No further input will be dispatched.');
      return;
    }
    const isAuto = this.approvalMode === 'full_access' || this.approvalMode === 'approve_for_me';
    // A batch runs blind from one screenshot: auto mode runs it whole, approval mode still reviews one action at a time.
    const effective = (isAuto ? planned : planned.slice(0, 1)).slice(0, room);
    const head = effective[0]!;
    this.record('decide', 'success', 'Decided ' + effective.length + ' action(s): ' + effective.map(item => item.type).join(' → '), { durationMs: this.lastDecideMs });
    const views: AgentAction[] = effective.map(item => ({
      id: this.dependencies.id(),
      type: item.type === 'keypress' ? 'key_press' : item.type === 'screenshot' ? 'verify' : item.type,
      description: this.dependencies.describe(item), timestamp: this.timestamp(),
      status: isAuto ? 'pending' : 'awaiting_approval',
      ...('x' in item ? { coordinates: { x: item.x, y: item.y } } : {}),
      ...('text' in item ? { text: item.text } : {}),
    }));
    const headView = views[0]!;

    if (isAuto) {
      this.pending = null;
      this.update({
        status: 'acting', pendingActionId: null, message: effective.map(item => this.dependencies.describe(item)).join(' → ').slice(0, 500),
        actions: [...this.state.actions.filter(item => item.status !== 'pending'), ...views],
      });
      this.launch({ actions: effective, actionIds: views.map(view => view.id), observation: frame });
      return;
    }

    this.pending = { action: head, observation: frame };
    this.update({
      status: 'awaiting_approval', pendingActionId: headView.id,
      message: decision.warnings.length ? decision.warnings.join(' · ') : 'Review this action before it is executed.',
      actions: [...this.state.actions.filter(item => item.status !== 'pending'), headView],
    });
  }

  /** Captures the screen when a text-mode decision needs it (GUI batch or finish). Null when the turn went stale. */
  private async freshCapture(signal: AbortSignal, generation: number): Promise<ScreenObservation | null> {
    this.update({ status: 'observing', message: 'Capturing the selected test desktop.' });
    const frame = await this.dependencies.desktop.capture(signal);
    if (!this.current(generation, signal)) return null;
    this.noteWindowFocus(frame);
    return frame;
  }

  private async shellTurn(signal: AbortSignal, generation: number, rawCommand: string, warnings: string[]): Promise<void> {
    if (!this.dependencies.shell) {
      this.fail('Terminal commands need a shell executor, which this host does not provide. Ask for desktop steps instead.');
      return;
    }
    const command = this.dependencies.validateShell(rawCommand);
    const room = this.state.maxSteps - this.state.actions.filter(item => item.status === 'executed').length;
    if (room <= 0) {
      this.fail('The action limit was reached. No further input will be dispatched.');
      return;
    }
    const isAuto = this.approvalMode === 'full_access' || this.approvalMode === 'approve_for_me';
    this.record('decide', 'success', 'Decided 1 terminal command.', { durationMs: this.lastDecideMs });
    if (!isAuto) {
      const id = this.dependencies.id();
      this.pendingShell = command;
      this.update({
        status: 'awaiting_approval', pendingActionId: id,
        message: warnings.length ? warnings.join(' · ') : 'Review this terminal command before it runs.',
        actions: [...this.state.actions.filter(item => item.status !== 'pending'),
          { id, type: 'shell', description: ('$ ' + command).slice(0, 300), timestamp: this.timestamp(), status: 'awaiting_approval' }],
      });
      return;
    }
    await this.runShellStep(signal, generation, command, null);
    if (!this.current(generation, signal)) return;
    await this.decideNext(signal, generation, null, null);
  }

  private launchShell(command: string, actionId: string): void {
    this.cancelOperation();
    const controller = new AbortController();
    this.operation = controller;
    const generation = this.generation;
    void this.approvedShellTurn(controller.signal, generation, command, actionId).catch(() => {
      if (this.current(generation, controller.signal)) this.fail('The task could not continue.');
    });
  }

  private async approvedShellTurn(signal: AbortSignal, generation: number, command: string, actionId: string): Promise<void> {
    await this.runShellStep(signal, generation, command, actionId);
    if (!this.current(generation, signal)) return;
    await this.decideNext(signal, generation, null, null);
  }

  /**
   * Runs one terminal command and records its text output as the observation.
   * The exit code plus output always counts as progress: the model reads the
   * text and self-corrects, so no screenshot or paid re-check is needed. Three
   * failing commands in a row hand control to the user instead of looping.
   */
  private async runShellStep(signal: AbortSignal, generation: number, command: string, reuseId: string | null): Promise<void> {
    const port = this.dependencies.shell!;
    const existing = reuseId ? this.state.actions.find(item => item.id === reuseId) : undefined;
    const id = existing?.id ?? this.dependencies.id();
    const started = this.now();
    this.update({
      status: 'acting', pendingActionId: null, message: ('$ ' + command).slice(0, 300),
      actions: existing
        ? this.state.actions.map(item => item.id === id ? { ...item, status: 'pending' } : item)
        : [...this.state.actions.filter(item => item.status !== 'pending'),
          { id, type: 'shell', description: ('$ ' + command).slice(0, 300), timestamp: this.timestamp(), status: 'pending' }],
    });
    const result = await port.run(command, signal);
    if (!this.current(generation, signal)) return;
    const shellMs = this.now() - started;
    const output = (result.stdout + (result.stderr ? '\n[stderr]\n' + result.stderr : '')).trim();
    const excerpt = output ? output.slice(0, 1500) : '(no output)';
    const failed = result.exitCode !== 0 || result.timedOut;
    const verification = {
      status: 'verified_success' as const,
      visualDeltaPercent: 0,
      summary: this.withTiming('Shell exit ' + result.exitCode + (result.timedOut ? ' (timed out)' : '') +
        (result.truncated ? ' (output truncated)' : '') + ': ' + excerpt, shellMs, 'shell'),
      verifiedAt: Date.now(),
    };
    this.state = {
      ...this.state,
      actions: this.state.actions.map(item => item.id === id ? { ...item, status: 'executed', text: output.slice(0, 2000), verification } : item),
    };
    this.unmetStreak = 0;
    this.noProgressStreak = 0;
    this.stallCycles = 0;
    this.lastGuidance = null;
    this.record('verify', failed ? 'failure' : 'success',
      'Shell: exit ' + result.exitCode + ' (' + output.length + ' output chars).', { stepId: id, durationMs: shellMs });
    this.persistPhase();
    if (!failed) {
      this.shellFailures = 0;
      return;
    }
    if (++this.shellFailures >= 3) {
      this.shellFailures = 0;
      this.yieldToUser({ kind: 'manual', reason: ('Three terminal commands failed in a row. Last: $ ' + command.slice(0, 200) +
        ' → exit ' + result.exitCode + ': ' + excerpt.slice(0, 300) +
        ' Take control of the desktop, fix the terminal state, then resume - or stop the run.').slice(0, 1000) });
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
    const intentBudget = this.tokenBudget();
    if (inputTokens > intentBudget.input || outputTokens > intentBudget.output) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return false;
    }
    if (decision.intent.missing.length) {
      // Every model question goes out in one handoff; the UI steps through them one by one.
      const asked = (decision.intent.questions ?? [])
        .filter(entry => entry.question.trim())
        .slice(0, 3)
        .map(entry => ({
          id: entry.id.slice(0, 32), question: entry.question.slice(0, 300),
          options: entry.options.filter(option => option.trim()).slice(0, 4).map(option => option.slice(0, 100)),
        }));
      const lead = asked[0];
      this.yieldToUser({
        kind: 'clarification',
        reason: (lead
          ? asked.length > 1
            ? asked.length + ' quick questions before I continue. First: ' + lead.question
            : lead.question
          : 'Before I touch the desktop, I need: ' + decision.intent.missing.join(', ') + '. Reply with the missing values.').slice(0, 1000),
        ...(lead ? { questions: asked } : {}),
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
    const planBudget = this.tokenBudget();
    if (inputTokens > planBudget.input || outputTokens > planBudget.output) {
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
          completedSteps: [...(item.completedSteps ?? [])], activeStep: item.activeStep ?? null,
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
    const retryNote = this.pendingResumeNote;
    this.pendingResumeNote = null;
    if (retryNote) {
      // Retry: refocus the model on the failed step and drop the dead run's
      // stall counts so the fresh attempt is not failed instantly.
      try {
        mission.addNote(resumed.phaseId, retryNote);
      } catch {
        // A retry note must never break resume.
      }
      this.noProgressStreak = 0;
      this.stallCycles = 0;
    } else {
      this.noProgressStreak = resumed.noProgressStreak;
      this.stallCycles = resumed.stallCycles ?? 0;
    }
    this.clarifications = [...resumed.clarifications];
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
  /**
   * Advances the live step pointer from the model's [step N] tag. Best-effort:
   * garbage tags never move it and never break the loop.
   */
  /**
   * Tracks foreground-window identity across captures so the model knows
   * which window it is in and stops re-opening what is already focused.
   * History-only: window titles never reach the journal or checkpoints.
   */
  private noteWindowFocus(observation: ScreenObservation): void {
    const id = observation.activeWindowId;
    if (this.lastWindowId !== null && this.lastWindowId !== id) {
      this.focusChanges.push('Focus changed: #' + this.lastWindowId + ' → #' + id);
      if (this.focusChanges.length > 10) this.focusChanges.splice(0, this.focusChanges.length - 10);
    }
    this.lastWindowId = id;
    this.lastWindowTitle = observation.activeWindowTitle?.slice(0, 200) ?? null;
  }

  private noteStepTag(message: string): void {
    const match = /\[step\s+(\d+)\]/i.exec(message);
    if (!match) return;
    const phase = this.mission?.currentPhase();
    if (!phase || !this.mission) return;
    try {
      this.mission.noteActiveStep(phase.phaseId, Number(match[1]));
    } catch {
      // Step tags must never break the loop.
    }
  }

  private async confirmPhaseSuccess(observation: ScreenObservation, signal: AbortSignal, generation: number): Promise<boolean> {
    const phase = this.mission?.currentPhase();
    if (!phase?.success) return true;
    const transcript = this.state.actions
      .filter(action => action.type === 'shell' && action.status === 'executed' && action.verification)
      .slice(-5)
      .map(action => action.description.slice(0, 200) + ' → ' + (action.verification?.summary ?? '').slice(0, 400));
    const check = await this.dependencies.model.verifySuccess({
      condition: phase.success, steps: [...phase.steps],
      ...(transcript.length ? { transcript } : {}),
      observation, signal,
    });
    if (!this.current(generation, signal)) return false;
    const inputTokens = this.state.inputTokens + check.inputTokens;
    const outputTokens = this.state.outputTokens + check.outputTokens;
    this.state = { ...this.state, inputTokens, outputTokens };
    const confirmBudget = this.tokenBudget();
    if (inputTokens > confirmBudget.input || outputTokens > confirmBudget.output) {
      this.fail('The run token allowance was reached. No further actions will be dispatched.');
      return false;
    }
    if (check.doneSteps && this.mission) {
      try {
        this.mission.setCompletedSteps(phase.phaseId, check.doneSteps.map(oneBased => oneBased - 1));
      } catch {
        // A bad audit must never break verification.
      }
    }
    if (check.confirmed) {
      this.unmetStreak = 0;
      this.stallCycles = 0;
      this.record('verify', 'success', 'Phase success confirmed: ' + phase.success);
      return true;
    }
    this.record('verify', 'failure', 'Phase success not met: ' + check.detail);
    if (++this.unmetStreak >= 2) {
      const recovery = this.dependencies.recovery ?? defaultErrorLoop;
      const reason = recovery.story({
        phase: this.phaseContext(),
        recentAttempts: this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
          .map(action => action.status + ': ' + action.description),
        verificationSummary: 'Phase success not met: ' + check.detail,
        priorGuidance: this.lastGuidance,
      });
      if (this.cappedStall(reason)) return false;
      this.yieldToUser({ kind: 'manual', reason });
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
        completedSteps: [...phase.completedSteps], activeStep: phase.activeStep,
        intent: this.state.intent ? { ...this.state.intent, params: { ...this.state.intent.params }, missing: [...this.state.intent.missing] } : null,
        clarifications: [...this.clarifications],
        executedDescs: [...this.resumedHistory,
          ...this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
            .map(action => action.status + ': ' + action.description)].slice(-60),
        lastVerification: this.state.actions.at(-1)?.verification?.summary ?? this.resumedHistory.at(-1) ?? null,
        inputTokens: this.state.inputTokens, outputTokens: this.state.outputTokens,
        noProgressStreak: this.noProgressStreak, stallCycles: this.stallCycles, savedAt: Date.now(),
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
    this.pendingShell = null;
    this.state = { ...this.state, pendingActionId: null, actions: this.state.actions.map(action => action.id === pendingId ? { ...action, status } : action) };
  }

  /**
   * Counts a stall handoff without progress. Fails the run on the third
   * consecutive cycle so escalate-resume-retry can never loop forever.
   * True when the run was failed.
   */
  /**
   * Appends the think/see cost to a step summary so slow runs show where time
   * went. Skipped when the clock never advanced, which also keeps tests exact.
   */
  /** Token budgets scale with the step allowance so big tasks are not starved; floors keep small runs cheap. */
  private tokenBudget(): { input: number; output: number } {
    return { input: Math.max(60_000, this.state.maxSteps * 6_000), output: Math.max(8_000, this.state.maxSteps * 1_500) };
  }

  private withTiming(summary: string, seeMs: number, label = 'see'): string {
    const thinkMs = this.lastDecideMs;
    if (thinkMs + seeMs <= 0) return summary;
    return summary + ' [think ' + (thinkMs / 1000).toFixed(1) + 's · ' + label + ' ' + (seeMs / 1000).toFixed(1) + 's]';
  }

  private cappedStall(reason: string): boolean {
    if (++this.stallCycles < 3) return false;
    this.fail(('Stopped after 3 stalls with no progress even after resume. Last wall: ' + reason.slice(0, 400) +
      ' Fix the screen, then start a new run from the kept goal.').slice(0, 1000));
    return true;
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
  private record(stage: JournalStage, outcome: JournalOutcome, summary: string, extra?: { stepId?: string | null; durationMs?: number }): void {
    const journal = this.dependencies.journal;
    const runId = this.state.runId;
    if (!journal || !runId) return;
    try {
      journal.append(createJournalEvent({
        missionId: this.missionId ?? runId, runId,
        phaseId: this.mission?.currentPhase()?.phaseId ?? null, stepId: extra?.stepId ?? null,
        stage, outcome, summary,
        ...(extra?.durationMs === undefined ? {} : { durationMs: extra.durationMs }),
        inputTokens: this.state.inputTokens, outputTokens: this.state.outputTokens,
      }));
    } catch {
      // Journaling must never break the agent loop.
    }
  }
}
