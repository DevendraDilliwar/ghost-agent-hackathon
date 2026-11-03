import { randomUUID } from 'node:crypto';
import { app, globalShortcut } from 'electron';
import type { BrowserWindow } from 'electron';
import { join } from 'node:path';
import os from 'node:os';
import { FileJournal } from '../../observability/journal';
import { CheckpointStore } from '../../observability/checkpoint-store';
import { RunHistoryStore, toRunRecord } from '../../observability/run-history-store';
import { AttachmentStore } from '../../observability/attachment-store';
import { SkillStore } from '../../observability/skill-store';
import { MemoryStore } from '../../observability/memory-store';
import type { RunRecord, RunSummary } from '../../shared/contracts/history';
import type { MissionSummary } from '../../shared/contracts/mission';
import { TaskController } from '../../agent/task-controller';
import { SkillMemory } from '../../agent/memory/skill-memory';
import { CrossTaskMemory } from '../../agent/memory/cross-task-memory';
import { UIGroundingEngine } from '../../agent/vision/ui-grounding';
import { UbuntuDesktop } from '../../desktop/linux/ubuntu-desktop';
import { createAtspiDetector } from '../../desktop/linux/atspi-reader';
import { TesseractOcr } from '../../desktop/linux/tesseract-ocr';
import { LocalShell } from '../../desktop/linux/local-shell';
import { MetaComputerModel } from '../../providers/meta/meta-computer-model';
import { describeCommand, validateDesktopCommand } from '../../policy/task-validation';
import { validateShellCommand } from '../../policy/shell-validation';
import type { RuntimeReadiness } from '../../shared/contracts/desktop';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { ModelConnection } from '../config/model-connection';
import { testMetaConnection } from '../../providers/meta/meta-request';
import { saveStoredApiKey, loadStoredApiKey, clearStoredApiKey, hasStoredApiKey } from '../config/secure-store';
import type { RunConfiguration, TaskSnapshot } from '../../shared/contracts/task';
import { controlsSnapshot } from '../windows/controls-snapshot';

const emergencyShortcuts = [
  { accelerator: 'Control+Shift+Escape', label: 'Ctrl + Shift + Escape' },
  { accelerator: 'Control+Alt+Shift+Escape', label: 'Ctrl + Alt + Shift + Escape' },
  { accelerator: 'Control+Shift+F12', label: 'Ctrl + Shift + F12' },
] as const;
const shortcutUnavailable = 'No emergency Stop shortcut is available. Another app or the desktop may be using these keys. Free one of ' +
  emergencyShortcuts.map(shortcut => shortcut.label).join(', ') + ' in your desktop keyboard settings, then choose Recheck desktop.';

function journalDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-journal');
  } catch {
    // In the test runner app.getPath is unavailable; journal to temp instead.
    return join(os.tmpdir(), 'nomcp-journal');
  }
}

function missionsDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-missions');
  } catch {
    return join(os.tmpdir(), 'nomcp-missions');
  }
}

function historyDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-history');
  } catch {
    return join(os.tmpdir(), 'nomcp-history');
  }
}

function attachmentsDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-attachments');
  } catch {
    return join(os.tmpdir(), 'nomcp-attachments');
  }
}

function skillsDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-skills');
  } catch {
    return join(os.tmpdir(), 'nomcp-skills');
  }
}

function memoryDirectory(): string {
  try {
    return join(app.getPath('userData'), 'nomcp-memory');
  } catch {
    return join(os.tmpdir(), 'nomcp-memory');
  }
}

export function createTaskRuntime(window: BrowserWindow, controls: BrowserWindow) {
  let disposed = false;
  let disposal: Promise<void> | null = null;
  const hostShell = process.env.GHOST_ENABLE_HOST_SHELL !== '0';
  const accessibility = process.env.GHOST_ENABLE_ACCESSIBILITY !== '0';
  const retainTaskContent = process.env.GHOST_RETAIN_TASK_CONTENT !== '0';
  const apiKey = process.env.META_API_KEY?.trim() ?? '';
  const model = process.env.GHOST_META_MODEL === 'muse-wonder-1.0' ? 'muse-wonder-1.0' : 'muse-spark-1.3';
  // Verification rides on Wonder by default; planning and decisions stay on Spark.
  // Set GHOST_VERIFY_MODEL=muse-spark-1.3 to force every call onto Spark.
  const verifyModel = process.env.GHOST_VERIFY_MODEL === 'muse-spark-1.3' ? 'muse-spark-1.3' : 'muse-wonder-1.0';
  const connection = new ModelConnection(apiKey, model, (key, signal) => testMetaConnection({ apiKey: key, model }, signal));

  // One shared background verification: test the saved (or environment) key
  // silently at startup, so a returning user is never asked to re-enter a
  // working key. Single-flighted - readiness() awaits this instead of
  // starting a second probe that would collide with it.
  let savedVerification: Promise<void> | null = null;
  function verifySavedKey(): Promise<void> {
    if (!savedVerification) {
      savedVerification = (async () => {
        try {
          const stored = await hasStoredApiKey();
          if (disposed) return;
          connection.setHasStored(stored);
          if (connection.info().verified) return;
          if (apiKey) {
            await connection.test(null);
          } else if (stored) {
            const storedKey = await loadStoredApiKey();
            if (!storedKey || disposed) return;
            await connection.test(storedKey);
            connection.setSource('stored');
          }
        } catch {
          // A saved key that fails to verify behaves like no key: the UI
          // prompts once, with the real state, instead of on every launch.
        }
      })();
    }
    return savedVerification;
  }
  void verifySavedKey();
  const desktop = new UbuntuDesktop(window, () => [controls]);
  let shortcut: typeof emergencyShortcuts[number] | null = null;
  const journal = new FileJournal(journalDirectory());
  const checkpoints = new CheckpointStore(missionsDirectory());
  const history = new RunHistoryStore(historyDirectory());
  const attachmentNames = new Map<string, string[]>();
  const attachmentStore = new AttachmentStore(attachmentsDirectory());
  const skills = new SkillMemory();
  const skillStore = new SkillStore(skillsDirectory());
  const memoryStore = new MemoryStore(memoryDirectory());
  const pendingHistory = new Map<string, NonNullable<ReturnType<typeof toRunRecord>>>();
  let historyWrites: Promise<void> | null = null;
  function queueHistory(record: NonNullable<ReturnType<typeof toRunRecord>>): void {
    pendingHistory.set(record.runId, record);
    if (historyWrites) return;
    historyWrites = (async () => {
      while (pendingHistory.size) {
        const next = pendingHistory.entries().next().value;
        if (!next) break;
        pendingHistory.delete(next[0]);
        await history.saveRun(next[1]);
      }
    })().finally(() => { historyWrites = null; });
  }
  function storageHealthy(): boolean {
    return [journal, history, checkpoints, skillStore, memoryStore, attachmentStore].every(store => store.healthy);
  }
  const controller = new TaskController({
    ...(retainTaskContent ? { checkpoints } : {}),
    journal,
    desktop,
    ...(hostShell ? { shell: new LocalShell() } : {}),
    skills,
    ...(retainTaskContent ? { skillStore } : {}),
    crossTaskMemory: new CrossTaskMemory(),
    ...(retainTaskContent ? { memoryStore } : {}),
    ocr: new TesseractOcr(),
    ...(retainTaskContent ? { sourceStore: { saveSource: (runId: string, files: import('../../shared/contracts/task').RunAttachmentInput[]) => attachmentStore.saveAttachments(runId, files) } } : {}),
    model: {
      decide: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).decide(input),
      parseIntent: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).parseIntent(input),
      plan: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).plan(input),
      verifySuccess: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model, verifyModel }).verifySuccess(input),
      verifyText: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model, verifyModel }).verifyText(input),
      readSource: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).readSource(input),
      extractFields: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).extractFields(input),
      fillPlan: input => new MetaComputerModel({ apiKey: connection.getKey(), hostShell, accessibility, model }).fillPlan(input),
    },
    id: randomUUID,
    describe: describeCommand, validateAction: validateDesktopCommand, validateShell: validateShellCommand,
    grounding: new UIGroundingEngine(accessibility ? createAtspiDetector() : undefined),
    changed: snapshot => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC_CHANNELS.taskChanged, snapshot);
      if (!controls.isDestroyed() && !controls.webContents.isDestroyed()) controls.webContents.send(IPC_CHANNELS.controlsChanged, controlsSnapshot(snapshot, shortcut?.label ?? null));
      if (snapshot.runId) {
        const record = toRunRecord(snapshot, attachmentNames.get(snapshot.runId) ?? [], retainTaskContent);
        if (record) queueHistory(record);
        if (snapshot.status === 'completed' || snapshot.status === 'stopped' || snapshot.status === 'failed') {
          attachmentNames.delete(snapshot.runId);
          void attachmentStore.pruneAttachments(snapshot.runId).catch(() => undefined);
        }
      }
    },
  });
  function ensureEmergencyStop(): boolean {
    if (disposed) return false;
    if (shortcut && globalShortcut.isRegistered(shortcut.accelerator)) return true;
    shortcut = null;
    for (const candidate of emergencyShortcuts) {
      try {
        // Never take over another registration owned by this process.
        if (globalShortcut.isRegistered(candidate.accelerator)) continue;
        if (globalShortcut.register(candidate.accelerator, () => {
          if (disposed) return;
          const snapshot = controller.getSnapshot();
          if (snapshot.runId) controller.stop(snapshot.runId);
        })) {
          shortcut = candidate;
          return true;
        }
      } catch { /* Try the next combination; report failure only when all fail. */ }
    }
    return false;
  }
  ensureEmergencyStop();

  return {
    controller,
    connection,
    getControlsSnapshot: () => controlsSnapshot(controller.getSnapshot(), shortcut?.label ?? null),
    start(configuration: RunConfiguration): TaskSnapshot {
      if (!connection.info().verified) throw new Error('Test your Meta connection in Settings before starting.');
      if (!ensureEmergencyStop()) throw new Error(shortcutUnavailable);
      const snapshot = controller.start(configuration);
      if (snapshot.runId) attachmentNames.set(snapshot.runId, (configuration.attachments ?? []).map(file => file.name.slice(0, 128)));
      return snapshot;
    },
    listMissions(): Promise<MissionSummary[]> {
      return retainTaskContent ? checkpoints.listMissions() : Promise.resolve([]);
    },
    async listRuns(): Promise<RunSummary[]> {
      await historyWrites;
      return history.listRuns();
    },
    async loadRun(runId: string): Promise<RunRecord | null> {
      await historyWrites;
      return history.loadRun(runId);
    },
    async deleteRun(runId: string): Promise<void> {
      const live = controller.getSnapshot();
      if (live.runId === runId && !['idle', 'completed', 'stopped', 'failed'].includes(live.status)) return;
      attachmentNames.delete(runId);
      await historyWrites;
      await history.deleteRun(runId);
      void attachmentStore.pruneAttachments(runId).catch(() => undefined);
    },
    async testConnection(candidate: unknown) {
      if (disposed) throw new Error('The task runtime is closing.');
      if (!['idle', 'completed', 'stopped', 'failed'].includes(controller.getSnapshot().status)) throw new Error('Stop the current task before changing the model connection.');
      if (candidate && typeof candidate === 'object') {
        const payload = candidate as { key?: unknown; remember?: unknown; forget?: unknown };
        if (payload.forget === true) {
          await clearStoredApiKey();
          connection.dispose();
          connection.setHasStored(false);
          return connection.info();
        }
        const key = payload.key === undefined ? null : payload.key;
        await connection.test(key);
        if (payload.remember === true && connection.info().verified) {
          await saveStoredApiKey(connection.getKey());
          connection.setHasStored(true);
          connection.setSource('stored');
        } else if (payload.remember === false) {
          await clearStoredApiKey();
          connection.setHasStored(false);
        }
        return connection.info();
      }
      return connection.test(candidate);
    },
    async readiness(): Promise<RuntimeReadiness> {
      const issues: string[] = [];
      let desktopSupported = true;
      const shortcutReady = ensureEmergencyStop();
      if (!shortcutReady) issues.push(shortcutUnavailable);
      try {
        await desktop.preflight(AbortSignal.timeout(6000));
      } catch (error) {
        desktopSupported = false;
        issues.push(error instanceof Error ? error.message : 'Desktop preflight failed.');
      }
      // Await the single-flighted background verification so Recheck never
      // starts a second probe and never reports stale "untested" state.
      await verifySavedKey();
      if (!storageHealthy()) issues.push('Local storage could not save run data. Check free space and file access before relying on recovery.');
      const info = connection.info();
      if (!info.configured) issues.unshift('Connect your Meta API key in Settings.');
      else if (!info.verified) issues.unshift('Test your Meta connection in Settings before starting.');
      return { storageHealthy: storageHealthy(), capabilities: { hostShell, accessibility, retainTaskContent }, ready: issues.length === 0, modelConfigured: info.configured, modelVerified: info.verified, desktopSupported,
        emergencyStopReady: shortcutReady, emergencyStopShortcut: shortcut?.label ?? null, issues };
    },
    dispose(): Promise<void> {
      if (disposal) return disposal;
      disposed = true;
      const snapshot = controller.getSnapshot();
      if (snapshot.runId) controller.stop(snapshot.runId);
      controller.dispose();
      connection.dispose();
      if (shortcut) globalShortcut.unregister(shortcut.accelerator);
      shortcut = null;
      disposal = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            (async () => {
              await historyWrites;
              await Promise.all([journal.drain(), history.drain(), checkpoints.drain(), skillStore.drain(), memoryStore.drain(), attachmentStore.drain()]);
              if (!storageHealthy()) console.error('Ghost Agent storage flush failed; some run data may be unavailable.');
            })(),
            new Promise<void>(resolve => { timer = setTimeout(() => {
              console.error('Ghost Agent storage flush timed out; some run data may be unavailable.');
              resolve();
            }, 5000); }),
          ]);
        } finally { if (timer) clearTimeout(timer); }
      })();
      return disposal;
    },
  };
}

export type TaskRuntime = ReturnType<typeof createTaskRuntime>;
