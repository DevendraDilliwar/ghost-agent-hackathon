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
import type { RunConfiguration, TaskSnapshot } from '../../shared/contracts/task';
import { controlsSnapshot } from '../windows/controls-snapshot';

const emergencyShortcut = 'CommandOrControl+Shift+Escape';

export function createTaskRuntime(window: BrowserWindow, controls: BrowserWindow) {
  const apiKey = process.env.META_API_KEY?.trim() ?? '';
  const model = process.env.GHOST_META_MODEL === 'muse-wonder-1.0' ? 'muse-wonder-1.0' : 'muse-spark-1.3';
  const connection = new ModelConnection(apiKey, model, (key, signal) => testMetaConnection({ apiKey: key, model }, signal));
  const desktop = new UbuntuDesktop(window, () => [controls]);
  const controller = new TaskController({
    desktop, model: { decide: input => new MetaComputerModel({ apiKey: connection.getKey(), model }).decide(input) }, id: randomUUID,
    describe: describeCommand, validateAction: validateDesktopCommand,
    changed: snapshot => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC_CHANNELS.taskChanged, snapshot);
      if (!controls.isDestroyed() && !controls.webContents.isDestroyed()) controls.webContents.send(IPC_CHANNELS.controlsChanged, controlsSnapshot(snapshot));
    },
  });
  let shortcutReady = false;
  try {
    shortcutReady = globalShortcut.register(emergencyShortcut, () => {
      const snapshot = controller.getSnapshot();
      if (snapshot.runId) controller.stop(snapshot.runId);
    });
  } catch { /* Preflight reports the unavailable emergency control. */ }

  return {
    controller,
    connection,
    start(configuration: RunConfiguration): TaskSnapshot {
      if (!connection.info().verified) throw new Error('Test your Meta connection in Settings before starting.');
      return controller.start(configuration);
    },
    async testConnection(candidate: unknown) {
      if (!['idle', 'completed', 'stopped', 'failed'].includes(controller.getSnapshot().status)) throw new Error('Stop the current task before changing the model connection.');
      return connection.test(candidate);
    },
    async readiness(): Promise<RuntimeReadiness> {
      const issues: string[] = [];
      let desktopSupported = true;
      if (!shortcutReady) issues.push('The emergency Stop shortcut could not be registered.');
      try {
        await desktop.preflight(AbortSignal.timeout(6000));
      } catch (error) {
        desktopSupported = false;
        issues.push(error instanceof Error ? error.message : 'Desktop preflight failed.');
      }
      const info = connection.info();
      if (!info.configured) issues.unshift('Connect your Meta API key in Settings.');
      else if (!info.verified) issues.unshift('Test your Meta connection in Settings before starting.');
      return { ready: issues.length === 0, modelConfigured: info.configured, modelVerified: info.verified, desktopSupported, emergencyStopReady: shortcutReady, issues };
    },
    dispose(): void {
      controller.dispose();
      connection.dispose();
      if (shortcutReady) globalShortcut.unregister(emergencyShortcut);
    },
  };
}

export type TaskRuntime = ReturnType<typeof createTaskRuntime>;
