import { useEffect, useState } from 'react';
import type { ControlsSnapshot } from '../../../../shared/contracts/controls';
import { MiniFloatingPopCard } from './MiniFloatingPopCard';

export function FloatingControlsView() {
  const [task, setTask] = useState<ControlsSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bridge = window.ghostControls;
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const accept = (next: ControlsSnapshot) => {
      if (active) setTask(current => current && current.revision > next.revision ? current : next);
    };
    const unsubscribe = bridge.onChanged(accept);
    void bridge.getSnapshot().then(accept).catch(() => { if (active) setError('Open the task window to reconnect.'); });
    return () => { active = false; unsubscribe(); };
  }, [bridge]);

  async function invoke(operation: () => Promise<void>) {
    setPending(true); setError(null);
    try { await operation(); }
    catch { setError('That control could not complete. Open the task window.'); }
    finally { setPending(false); }
  }
  return <MiniFloatingPopCard task={task} pending={pending} error={error}
    onExpand={() => { if (bridge) void invoke(() => bridge.openTask()); }}
    onPause={() => { if (bridge && task?.runId) void invoke(() => bridge.pause(task.runId!)); }}
    onResume={() => { if (bridge && task?.runId) void invoke(() => bridge.resume(task.runId!)); }}
    onStop={() => { if (bridge && task?.runId) void invoke(() => bridge.stop(task.runId!)); }} />;
}
