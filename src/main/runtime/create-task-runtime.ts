import { randomUUID } from 'node:crypto';
import { globalShortcut } from 'electron';
import type { BrowserWindow } from 'electron';
import { TaskController } from '../../agent/task-controller';
import { UbuntuDesktop } from '../../desktop/linux/ubuntu-desktop';
import { MetaComputerModel } from '../../providers/meta/meta-computer-model';
import { describeCommand, validateDesktopCommand } from '../../policy/task-validation';
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

export function createTaskRuntime(window: BrowserWindow, controls: BrowserWindow) {
  const apiKey = process.env.META_API_KEY?.trim() ?? '';
  const model = process.env.GHOST_META_MODEL === 'muse-wonder-1.0' ? 'muse-wonder-1.0' : 'muse-spark-1.3';
  const connection = new ModelConnection(apiKey, model, (key, signal) => testMetaConnection({ apiKey: key, model }, signal));

  void (async () => {
    try {
      const hasStored = await hasStoredApiKey();
      connection.setHasStored(hasStored);
      if (!apiKey && hasStored) {
        const storedKey = await loadStoredApiKey();
        if (storedKey) {
          await connection.test(storedKey).catch(() => undefined);
          connection.setSource('stored');
          connection.setHasStored(true);
        }
      }
    } catch {
      // Non-blocking initialization
    }
  })();
  const desktop = new UbuntuDesktop(window, () => [controls]);
  let shortcut: typeof emergencyShortcuts[number] | null = null;
  let disposed = false;
  const controller = new TaskController({
    desktop, model: { decide: input => new MetaComputerModel({ apiKey: connection.getKey(), model }).decide(input) }, id: randomUUID,
    describe: describeCommand, validateAction: validateDesktopCommand,
    changed: snapshot => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC_CHANNELS.taskChanged, snapshot);
      if (!controls.isDestroyed() && !controls.webContents.isDestroyed()) controls.webContents.send(IPC_CHANNELS.controlsChanged, controlsSnapshot(snapshot, shortcut?.label ?? null));
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
      return controller.start(configuration);
    },
    async testConnection(candidate: unknown) {
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
      if (!connection.getKey()) {
        try {
          const storedKey = await loadStoredApiKey();
          if (storedKey) {
            await connection.test(storedKey).catch(() => undefined);
            connection.setSource('stored');
            connection.setHasStored(true);
          }
        } catch { /* Ignore */ }
      }
      const info = connection.info();
      if (!info.configured) issues.unshift('Connect your Meta API key in Settings.');
      else if (!info.verified) issues.unshift('Test your Meta connection in Settings before starting.');
      return { ready: issues.length === 0, modelConfigured: info.configured, modelVerified: info.verified, desktopSupported,
        emergencyStopReady: shortcutReady, emergencyStopShortcut: shortcut?.label ?? null, issues };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      controller.dispose();
      connection.dispose();
      if (shortcut) globalShortcut.unregister(shortcut.accelerator);
      shortcut = null;
    },
  };
}

export type TaskRuntime = ReturnType<typeof createTaskRuntime>;
