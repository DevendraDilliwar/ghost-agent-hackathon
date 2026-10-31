import type { AgentAction, RunConfiguration, TaskSnapshot, UserHandoff } from '../shared/contracts/task';
import type { DesktopPort, ModelPort } from './ports';
import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';
import { defaultGroundingEngine } from './vision/ui-grounding';
import { defaultPrismVerifier } from './vision/prism-verifier';

interface ControllerDependencies {
  desktop: DesktopPort;
  model: ModelPort;
  id: () => string;
  describe: (action: DesktopCommand) => string;
  validateAction: (action: unknown, observation: ScreenObservation) => DesktopCommand;
  changed: (snapshot: TaskSnapshot) => void;
  now?: () => number;
}

export function idleSnapshot(): TaskSnapshot {
  return {
    runId: null, revision: 0, status: 'idle', goal: '', maxSteps: 15, actions: [],
    messages: [], screenshot: null, pendingActionId: null, message: 'Ready for a test task.',
    awaitingCompletion: false, handoff: null, inputTokens: 0, outputTokens: 0,
    groundedElements: [],
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

  constructor(private readonly dependencies: ControllerDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  getSnapshot(): TaskSnapshot {
    return structuredClone(this.state);
  }

  start(configuration: RunConfiguration): TaskSnapshot {
    if (this.isActive()) throw new Error('Stop the current run before starting another.');
    this.clearDeadline();
    this.pending = null;
    this.clarifications = [];
    this.state = {
      ...idleSnapshot(), revision: this.state.revision, runId: this.dependencies.id(), goal: configuration.goal,
      maxSteps: configuration.maxSteps, status: 'preparing',
      messages: [{ id: this.dependencies.id(), sender: 'user', content: configuration.goal, timestamp: this.timestamp() }],
      message: 'Checking desktop and model access.',
    };
    this.deadline = setTimeout(() => this.fail('The five-minute run limit was reached.'), 300_000);
    this.publish();
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
      await this.dependencies.desktop.preflight(signal);
      if (!this.current(generation, signal)) return;
      if (execution) {
        await this.dependencies.desktop.execute(execution.action, execution.observation, signal);
        if (!this.current(generation, signal)) return;
      }

      this.update({ status: 'observing', message: 'Capturing the selected test desktop.' });
      const observation = await this.dependencies.desktop.capture(signal);
      if (!this.current(generation, signal)) return;

      if (execution) {
        const verdict = defaultPrismVerifier.verifyTransition(execution.observation, observation, execution.action);
        const last = this.state.actions.at(-1);
        this.state = {
          ...this.state,
          actions: this.state.actions.map(action => action.id === last?.id ? { ...action, status: 'executed', verification: verdict } : action),
        };
      }
      const grounding = defaultGroundingEngine.groundScreen(observation);
      this.update({
        status: 'thinking',
        screenshot: observation.image,
        message: 'SAM 3.1 grounded ' + grounding.totalElements + ' interactive elements. Asking Meta for the next step.',
        groundedElements: grounding.elements,
      });
      const history = this.state.actions.filter(action => ['executed', 'failed'].includes(action.status))
        .map(action => action.status + ': ' + action.description);
      history.push(...this.clarifications.map(answer => 'User clarification: ' + answer));
      const decision = await this.dependencies.model.decide({ goal: this.state.goal, observation, history, signal, grounding });
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
      const view: AgentAction = {
        id, type: action.type === 'keypress' ? 'key_press' : action.type === 'screenshot' ? 'verify' : action.type,
        description: this.dependencies.describe(action), timestamp: this.timestamp(), status: 'awaiting_approval',
        ...('x' in action ? { coordinates: { x: action.x, y: action.y } } : {}),
        ...('text' in action ? { text: action.text } : {}),
      };
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

  private isActive(): boolean {
    return !['idle', 'completed', 'stopped', 'failed'].includes(this.state.status);
  }

  private yieldToUser(handoff: UserHandoff): void {
    this.markInterruptedInput();
    this.cancelOperation();
    this.invalidatePending('rejected');
    this.update({ status: 'needs_user', handoff, screenshot: null, awaitingCompletion: false, message: handoff.reason });
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
}
