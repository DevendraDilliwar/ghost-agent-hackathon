import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import type { ShellPort, ShellResult } from '../../agent/ports';

const OUTPUT_LIMIT = 65536;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Runs agent shell commands on the host. One command per call, from the
 * user's home directory, with a timeout, per-stream output caps, and abort
 * support. Never throws for command failures: the exit code carries them.
 */
export class LocalShell implements ShellPort {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async run(command: string, signal: AbortSignal): Promise<ShellResult> {
    signal.throwIfAborted();
    const started = Date.now();
    return new Promise(resolve => {
      const child = spawn('/bin/bash', ['-c', command], {
        cwd: homedir(), signal, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let truncated = false;
      let timedOut = false;
      let settled = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: signal.aborted ? 130 : timedOut ? 124 : code ?? 1,
          stdout: stdout.slice(0, OUTPUT_LIMIT),
          stderr: stderr.slice(0, OUTPUT_LIMIT),
          truncated,
          timedOut,
          durationMs: Date.now() - started,
        });
      };
      const collect = (chunk: Buffer, out: boolean) => {
        if (out) stdout += chunk.toString();
        else stderr += chunk.toString();
        if (stdout.length + stderr.length > OUTPUT_LIMIT * 2 && !truncated) {
          truncated = true;
          child.kill('SIGKILL');
        }
      };
      child.stdout.on('data', (chunk: Buffer) => collect(chunk, true));
      child.stderr.on('data', (chunk: Buffer) => collect(chunk, false));
      child.on('error', () => finish(127));
      child.on('close', finish);
    });
  }
}
