import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import type { ShellPort, ShellResult } from '../../agent/ports';

const OUTPUT_LIMIT = 65536;
const DEFAULT_TIMEOUT_MS = 30000;
/** After the foreground shell exits, wait this long for trailing pipe output before returning. */
const EXIT_DRAIN_MS = 250;
/** Last-resort wait after a kill before returning anyway. */
const KILL_GRACE_MS = 2000;

/**
 * Runs agent shell commands on the host. One command per call, from the
 * user's home directory, with a timeout, per-stream output caps, and abort
 * support. Never throws for command failures: the exit code carries them.
 *
 * Each command runs in its own detached process group. Backgrounded
 * grandchildren (GUI launches like `libreoffice --writer &`) never hold a
 * call hostage: the call returns once the foreground shell exits, leaving
 * them running. Only a still-running foreground is group-killed on timeout,
 * truncation, or abort.
 */
export class LocalShell implements ShellPort {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async run(command: string, signal: AbortSignal): Promise<ShellResult> {
    signal.throwIfAborted();
    const started = Date.now();
    return new Promise(resolve => {
      const child = spawn('/bin/bash', ['-c', command], {
        cwd: homedir(), signal, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
      });
      let stdout = '';
      let stderr = '';
      let truncated = false;
      let timedOut = false;
      let settled = false;
      let exitCode: number | null = null;
      let drain: ReturnType<typeof setTimeout> | null = null;
      let force: ReturnType<typeof setTimeout> | null = null;
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (drain) clearTimeout(drain);
        if (force) clearTimeout(force);
        signal.removeEventListener('abort', onAbort);
        // Node emits 'error' synchronously during abort dispatch, so finish can
        // run (and remove onAbort) before onAbort itself fires. Kill here too:
        // an abort must never orphan the process group.
        if (signal.aborted) killGroup();
        // Grandchildren may outlive the call (GUI launches): stop collecting
        // and discard any further pipe output so they never block on a write.
        child.stdout.removeAllListeners('data');
        child.stderr.removeAllListeners('data');
        child.stdout.resume();
        child.stderr.resume();
        resolve({
          exitCode: signal.aborted ? 130 : timedOut ? 124 : code ?? 1,
          stdout: stdout.slice(0, OUTPUT_LIMIT),
          stderr: stderr.slice(0, OUTPUT_LIMIT),
          truncated,
          timedOut,
          durationMs: Date.now() - started,
        });
      };
      const killGroup = () => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          try { child.kill('SIGKILL'); } catch { /* already gone */ }
        }
      };
      const armForceFinish = () => {
        if (force || settled) return;
        force = setTimeout(() => finish(1), KILL_GRACE_MS);
        if (typeof force.unref === 'function') force.unref();
      };
      function onAbort() {
        killGroup();
        armForceFinish();
      }
      signal.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        killGroup();
        armForceFinish();
      }, this.timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      const collect = (chunk: Buffer, out: boolean) => {
        if (out) stdout += chunk.toString();
        else stderr += chunk.toString();
        if (stdout.length + stderr.length > OUTPUT_LIMIT * 2 && !truncated) {
          truncated = true;
          killGroup();
          armForceFinish();
        }
      };
      child.stdout.on('data', (chunk: Buffer) => collect(chunk, true));
      child.stderr.on('data', (chunk: Buffer) => collect(chunk, false));
      child.on('error', () => finish(127));
      child.on('exit', code => {
        exitCode = code;
        // Foreground done: trailing output may still be in flight, and
        // backgrounded grandchildren may hold the pipes open indefinitely.
        // Drain briefly, then return without waiting for them.
        if (!drain && !settled) {
          drain = setTimeout(() => finish(exitCode), EXIT_DRAIN_MS);
          if (typeof drain.unref === 'function') drain.unref();
        }
      });
      child.on('close', finish);
    });
  }
}
