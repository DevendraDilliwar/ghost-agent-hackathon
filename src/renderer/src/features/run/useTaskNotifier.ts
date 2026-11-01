import { useEffect, useRef } from 'react';
import type { TaskSnapshot } from '../../../../shared/contracts/task';
import { describeNotification, showNotification } from '../../lib/task-notifier';

/** Fires one OS notification per notable task event while enabled. */
export function useTaskNotifier(snapshot: TaskSnapshot | null, enabled: boolean): void {
  const previous = useRef<TaskSnapshot | null>(null);
  const seen = useRef(new Set<string>());
  const lastRunId = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      previous.current = null;
      return;
    }
    if (snapshot.runId !== lastRunId.current) {
      lastRunId.current = snapshot.runId;
      seen.current.clear();
    }
    const event = describeNotification(previous.current, snapshot);
    previous.current = snapshot;
    if (!enabled || !event || seen.current.has(event.key)) return;
    seen.current.add(event.key);
    showNotification(event);
  }, [snapshot, enabled]);
}
