import type { RunConfiguration, TaskSnapshot } from './task';
import type { RuntimeReadiness } from './desktop';
import type { ModelConnectionInfo } from './model';

export type DesktopSession = 'x11' | 'wayland' | 'unknown';

export interface ApplicationInfo {
  readonly name: string;
  readonly version: string;
  readonly platform: string;
  readonly desktopSession: DesktopSession;
  readonly automationReady: false;
}

export interface DesktopBridge {
  getApplicationInfo(): Promise<ApplicationInfo>;
  getRuntimeReadiness(): Promise<RuntimeReadiness>;
  getModelConnection(): Promise<ModelConnectionInfo>;
  testModelConnection(apiKey: string | null): Promise<ModelConnectionInfo>;
  showFloatingControls(): Promise<void>;
  getTaskSnapshot(): Promise<TaskSnapshot>;
  startTask(configuration: RunConfiguration): Promise<TaskSnapshot>;
  pauseTask(runId: string): Promise<TaskSnapshot>;
  takeOverTask(runId: string): Promise<TaskSnapshot>;
  resumeTask(runId: string, answer: string | null): Promise<TaskSnapshot>;
  stopTask(runId: string): Promise<TaskSnapshot>;
  reviewAction(runId: string, actionId: string, approve: boolean): Promise<TaskSnapshot>;
  confirmCompletion(runId: string, verified: boolean): Promise<TaskSnapshot>;
  onTaskChanged(listener: (snapshot: TaskSnapshot) => void): () => void;
}
