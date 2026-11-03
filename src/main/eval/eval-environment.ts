import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Explicit operator acknowledgement, not proof of an OS sandbox. */
export function assertEvalIsolation(): void {
  if (process.env.GHOST_EVAL_ISOLATED !== '1') {
    throw new Error('Eval requires a disposable Ubuntu X11 session. Set GHOST_EVAL_ISOLATED=1 only inside that environment.');
  }
}

/** Each eval root owns a distinct office profile. Never kill processes by name. */
export async function prepareEvalOffice(root: string, taskId: string): Promise<void> {
  assertEvalIsolation();
  if (!['T2', 'T4', 'T5'].includes(taskId)) return;
  const profile = pathToFileURL(join(root, 'office-profile')).href;
  await new Promise<void>((resolve, reject) => {
    const child = spawn('/usr/bin/libreoffice', ['-env:UserInstallation=' + profile, '--norestore', '--nofirststartwizard',
      taskId === 'T5' ? '--calc' : '--writer'], { shell: false, detached: true, stdio: 'ignore' });
    child.once('spawn', () => { child.unref(); resolve(); });
    // Keep an error listener even after spawn. Never expose arbitrary process output.
    child.on('error', () => reject(new Error('Could not start the isolated office fixture.')));
  });
  // Office can fork/hand off to its profile owner. A launcher PID is not proof
  // of descendant ownership; cleanup is a disposable-session reset, not pkill.
}

export function evalOutcome(artifactPass: boolean, status: string, timedOut: boolean, interventions: number) {
  const autonomousPass = artifactPass && status === 'completed' && !timedOut && interventions === 0;
  return { artifactPass, autonomousPass, success: autonomousPass };
}
