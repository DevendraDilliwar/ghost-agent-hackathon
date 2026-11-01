import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskController } from '../../agent/task-controller';
import { UIGroundingEngine } from '../../agent/vision/ui-grounding';
import { LocalShell } from '../../desktop/linux/local-shell';
import { createAtspiDetector } from '../../desktop/linux/atspi-reader';
import { UbuntuDesktop } from '../../desktop/linux/ubuntu-desktop';
import { CheckpointStore } from '../../observability/checkpoint-store';
import { MetaComputerModel } from '../../providers/meta/meta-computer-model';
import { testMetaConnection } from '../../providers/meta/meta-request';
import { describeCommand, validateDesktopCommand } from '../../policy/task-validation';
import { validateShellCommand } from '../../policy/shell-validation';
import type { JournalEvent, JournalSink } from '../../shared/contracts/journal';
import type { MetaModelId } from '../../shared/contracts/model';
import type { TaskSnapshot } from '../../shared/contracts/task';
import { loadStoredApiKey } from '../config/secure-store';
import { EVAL_TASKS, type EvalTask } from './eval-tasks';

export interface EvalResult {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly success: boolean;
  readonly verifyDetail: string;
  readonly status: string;
  readonly message: string;
  readonly lastActions: string[];
  readonly steps: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
  readonly stalls: number;
  readonly handoffs: number;
  readonly timedOut: boolean;
  readonly workdir: string;
  readonly journalFile: string | null;
}

interface EvalContext {
  readonly root: string;
  readonly apiKey: string;
  readonly model: MetaModelId;
  readonly verifyModel: MetaModelId;
  readonly desktop: UbuntuDesktop;
  readonly checkpoints: CheckpointStore;
}

class CollectingJournal implements JournalSink {
  readonly events: JournalEvent[] = [];
  append(event: JournalEvent): void {
    this.events.push(event);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modelConfig(): { model: MetaModelId; verifyModel: MetaModelId } {
  const model = process.env.GHOST_META_MODEL === 'muse-wonder-1.0' ? 'muse-wonder-1.0' : 'muse-spark-1.3';
  const verifyModel = process.env.GHOST_VERIFY_MODEL === 'muse-spark-1.3' ? 'muse-spark-1.3' : 'muse-wonder-1.0';
  return { model, verifyModel };
}

async function resolveApiKey(): Promise<string> {
  const env = process.env.META_API_KEY?.trim();
  if (env) return env;
  return (await loadStoredApiKey())?.trim() ?? '';
}

async function runEvalTask(task: EvalTask, ctx: EvalContext): Promise<EvalResult> {
  const started = Date.now();
  const base = { id: task.id, name: task.name, kind: task.kind, workdir: ctx.root };
  try {
    task.setup(ctx.root);
  } catch (error) {
    return { ...base, success: false, verifyDetail: 'setup failed: ' + message(error), status: 'setup-error', message: '',
      lastActions: [], steps: 0, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - started, stalls: 0, handoffs: 0,
      timedOut: false, journalFile: null };
  }
  const journal = new CollectingJournal();
  let latest: TaskSnapshot | null = null;
  let handoff: string | null = null;
  let timedOut = false;
  let finish: (() => void) | null = null;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const controller = new TaskController({
    checkpoints: ctx.checkpoints, journal, desktop: ctx.desktop, shell: new LocalShell(),
    model: {
      decide: input => new MetaComputerModel({ apiKey: ctx.apiKey, model: ctx.model }).decide(input),
      parseIntent: input => new MetaComputerModel({ apiKey: ctx.apiKey, model: ctx.model }).parseIntent(input),
      plan: input => new MetaComputerModel({ apiKey: ctx.apiKey, model: ctx.model }).plan(input),
      verifySuccess: input => new MetaComputerModel({ apiKey: ctx.apiKey, model: ctx.model, verifyModel: ctx.verifyModel }).verifySuccess(input),
      verifyText: input => new MetaComputerModel({ apiKey: ctx.apiKey, model: ctx.model, verifyModel: ctx.verifyModel }).verifyText(input),
    },
    id: randomUUID,
    describe: describeCommand, validateAction: validateDesktopCommand, validateShell: validateShellCommand,
    grounding: new UIGroundingEngine(createAtspiDetector()),
    changed: snapshot => {
      latest = snapshot;
      if (snapshot.status === 'verifying' && snapshot.awaitingCompletion && snapshot.runId) {
        try {
          controller.confirm(snapshot.runId, true);
        } catch {
          // Already settled.
        }
      } else if (snapshot.status === 'needs_user') {
        handoff = snapshot.handoff ? snapshot.handoff.kind + ': ' + snapshot.handoff.reason.slice(0, 200) : 'unknown';
        try {
          if (snapshot.runId) controller.stop(snapshot.runId);
        } catch {
          // Already settled.
        }
      } else if (snapshot.status === 'completed' || snapshot.status === 'failed' || snapshot.status === 'stopped') {
        finish?.();
      }
    },
  });
  let runId: string | null;
  try {
    runId = controller.start({ goal: task.goal(ctx.root), maxSteps: task.maxSteps, maxMinutes: task.maxMinutes,
      approvalMode: 'full_access', screenConsent: true, isolatedEnvironment: true }).runId ?? null;
  } catch (error) {
    return { ...base, success: false, verifyDetail: 'start failed: ' + message(error), status: 'start-error', message: '',
      lastActions: [], steps: 0, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - started, stalls: 0, handoffs: 0,
      timedOut: false, journalFile: null };
  }
  const timeout = setTimeout(() => {
    timedOut = true;
    try {
      if (runId) controller.stop(runId);
    } catch {
      // Already settled.
    }
    finish?.();
  }, task.maxMinutes * 60_000 + 60_000);
  const heartbeat = setInterval(() => {
    process.stdout.write('  …still running (' + Math.round((Date.now() - started) / 1000) + 's, ' + (latest?.status ?? '?') + ')\n');
  }, 60_000);
  heartbeat.unref();
  await done;
  clearTimeout(timeout);
  clearInterval(heartbeat);
  const snapshot = latest ?? controller.getSnapshot();
  const executed = snapshot.actions.filter(action => action.status === 'executed').length;
  const stalls = journal.events.filter(event => event.outcome === 'stalled').length;
  const handoffs = journal.events.filter(event => event.stage === 'handoff').length;
  let journalFile: string | null = null;
  try {
    const file = join(ctx.root, task.id + '-journal.json');
    writeFileSync(file, JSON.stringify(journal.events, null, 2));
    journalFile = file;
  } catch {
    // Journal dump must never break the scorecard.
  }
  let verdict: { pass: boolean; detail: string };
  try {
    verdict = task.verify(ctx.root);
  } catch (error) {
    verdict = { pass: false, detail: 'verify threw: ' + message(error) };
  }
  return { ...base, success: verdict.pass,
    verifyDetail: verdict.detail + (handoff ? ' Handoff: ' + handoff : '') + (timedOut ? ' (eval timeout)' : ''),
    status: snapshot.status, message: snapshot.message.slice(0, 500),
    lastActions: snapshot.actions.slice(-5).map(action => action.status + ': ' + action.description.slice(0, 120)),
    steps: executed, inputTokens: snapshot.inputTokens, outputTokens: snapshot.outputTokens,
    durationMs: Date.now() - started, stalls, handoffs, timedOut, journalFile };
}

/**
 * Runs the benchmark suite headlessly: one hidden window, fresh controller
 * per task, programmatic setup/verify, JSON scorecard. Exit 0 when the suite
 * completes (task failures are data), 2 on config errors, 1 on crashes.
 */
export async function runEvalCli(): Promise<number> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const root = join(tmpdir(), 'ghost-eval-' + stamp + '-' + process.pid);
  mkdirSync(root, { recursive: true });
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.error('No Meta API key. Set META_API_KEY or save one in the app first.');
    return 2;
  }
  const { model, verifyModel } = modelConfig();
  console.log('Ghost eval: ' + EVAL_TASKS.length + ' tasks on ' + model + ', workdir ' + root);
  try {
    await testMetaConnection({ apiKey, model }, new AbortController().signal);
  } catch (error) {
    console.error('Model preflight failed: ' + message(error));
    return 2;
  }
  const hidden = new BrowserWindow({ show: false, width: 16, height: 16 });
  try {
    const ctx: EvalContext = { root, apiKey, model, verifyModel,
      desktop: new UbuntuDesktop(hidden, () => []), checkpoints: new CheckpointStore(join(root, 'checkpoints')) };
    const results: EvalResult[] = [];
    for (const task of EVAL_TASKS) {
      console.log('[' + task.id + '] ' + task.name + ' (' + task.kind + ', up to ' + task.maxSteps + ' steps, ' + task.maxMinutes + 'm)');
      const result = await runEvalTask(task, ctx);
      results.push(result);
      console.log('  → ' + (result.success ? 'PASS' : 'FAIL') + ' ' + result.verifyDetail +
        ' [' + result.status + ', ' + result.steps + ' steps, ' + Math.round(result.durationMs / 1000) + 's, ' +
        result.inputTokens + '/' + result.outputTokens + ' tok, ' + result.stalls + ' stalls]');
      if (result.message) console.log('  msg: ' + result.message.slice(0, 300));
    }
    const outDir = join(process.cwd(), 'eval-results');
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'eval-' + stamp + '.json');
    writeFileSync(outFile, JSON.stringify({ stamp, root, results }, null, 2));
    const passed = results.filter(result => result.success).length;
    console.log('\nScorecard: ' + passed + '/' + results.length + ' passed. JSON: ' + outFile);
  } finally {
    try {
      hidden.destroy();
    } catch {
      // Already gone.
    }
  }
  return 0;
}
