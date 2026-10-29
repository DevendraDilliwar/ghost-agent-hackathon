import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuntimeReadiness } from '../../../../shared/contracts/desktop';
import type { ModelConnectionInfo } from '../../../../shared/contracts/model';
import type { RunConfiguration, TaskSnapshot } from '../../../../shared/contracts/task';

function message(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'The desktop command failed.';
}

export function useTaskRuntime() {
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null);
  const [readiness, setReadiness] = useState<RuntimeReadiness | null>(null);
  const [connection, setConnection] = useState<ModelConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const bridge = window.ghostAgent;

  const accept = useCallback((next: TaskSnapshot) => {
    setSnapshot(current => current && current.revision > next.revision ? current : next);
  }, []);

  const refresh = useCallback(async () => {
    if (!bridge) return;
    const [capabilities, model] = await Promise.all([bridge.getRuntimeReadiness(), bridge.getModelConnection()]);
    if (mounted.current) { setReadiness(capabilities); setConnection(model); }
  }, [bridge]);

  useEffect(() => {
    mounted.current = true;
    if (!bridge) return () => { mounted.current = false; };
    let active = true;
    const unsubscribe = bridge.onTaskChanged(next => { if (active) accept(next); });
    void Promise.all([bridge.getTaskSnapshot(), refresh()])
      .then(([task]) => { if (active) accept(task); })
      .catch(() => { if (active) setError('Could not connect to the desktop runtime. Restart Ghost Agent.'); });
    return () => { active = false; mounted.current = false; unsubscribe(); };
  }, [accept, bridge, refresh]);

  const command = useCallback(async (invoke: () => Promise<TaskSnapshot>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const next = await invoke();
      if (mounted.current) accept(next);
    } catch (failure) {
      if (mounted.current) setError(message(failure));
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [accept]);

  const runCommand = (invoke: (runId: string) => Promise<TaskSnapshot>) => {
    if (snapshot?.runId) void command(() => invoke(snapshot.runId!));
  };

  return {
    snapshot, readiness, connection, error, setupError, pending,
    connected: Boolean(bridge),
    refresh: () => { void refresh().catch(failure => { if (mounted.current) setSetupError(message(failure)); }); },
    connectModel: async (candidate: string | null) => {
      if (!bridge || busy.current) return;
      busy.current = true; setPending(true); setSetupError(null);
      try { await bridge.testModelConnection(candidate); }
      catch (failure) { if (mounted.current) setSetupError(message(failure)); }
      finally {
        try { await refresh(); } catch { if (mounted.current) setSetupError('Could not refresh setup. Reopen Settings to try again.'); }
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    showControls: () => {
      if (bridge) void bridge.showFloatingControls().catch(failure => { if (mounted.current) setError(message(failure)); });
    },
    launch: (configuration: RunConfiguration) => { if (bridge) void command(() => bridge.startTask(configuration)); },
    pause: () => { if (bridge) runCommand(id => bridge.pauseTask(id)); },
    takeOver: () => { if (bridge) runCommand(id => bridge.takeOverTask(id)); },
    resume: () => { if (bridge) runCommand(id => bridge.resumeTask(id, null)); },
    answerAndResume: (answer: string) => { if (bridge) runCommand(id => bridge.resumeTask(id, answer)); },
    // Stop is never dropped merely because another UI command is pending.
    stop: () => {
      if (bridge && snapshot?.runId) void bridge.stopTask(snapshot.runId).then(next => { if (mounted.current) accept(next); })
        .catch(failure => { if (mounted.current) setError(message(failure)); });
    },
    review: (id: string, approve: boolean) => { if (bridge) runCommand(runId => bridge.reviewAction(runId, id, approve)); },
    confirm: (verified: boolean) => { if (bridge) runCommand(id => bridge.confirmCompletion(id, verified)); },
  };
}

export type TaskRuntimeView = ReturnType<typeof useTaskRuntime>;
