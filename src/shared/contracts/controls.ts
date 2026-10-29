import type { AgentStatus } from './task';

export interface ControlsSnapshot {
  readonly runId: string | null;
  readonly revision: number;
  readonly status: AgentStatus;
  readonly executed: number;
  readonly maxSteps: number;
  readonly canResume: boolean;
}

export interface FloatingControlsBridge {
  getSnapshot(): Promise<ControlsSnapshot>;
  pause(runId: string): Promise<void>;
  resume(runId: string): Promise<void>;
  stop(runId: string): Promise<void>;
  openTask(): Promise<void>;
  onChanged(listener: (snapshot: ControlsSnapshot) => void): () => void;
}
