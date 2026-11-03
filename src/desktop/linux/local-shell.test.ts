import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { LocalShell } from './local-shell';

const signal = () => new AbortController().signal;

/** True when a probe process with the marker is still alive. Missing pgrep reads as "no stray observed". */
const strayProbe = (marker: string): boolean => {
  try {
    execFileSync('pgrep', ['-f', marker], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

describe('LocalShell', () => {
  it('runs a command from the home directory and captures output', async () => {
    const result = await new LocalShell().run('pwd && echo hello', signal());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')[0]).toBe(homedir());
    expect(result.stdout).toContain('hello');
    expect(result.timedOut).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('carries exit codes and stderr instead of throwing', async () => {
    const result = await new LocalShell().run('echo oops >&2; exit 3', signal());
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('oops');
  });

  it('truncates runaway output instead of growing forever', async () => {
    const result = await new LocalShell().run('seq 1 1000000', signal());
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(65536);
  });

  it('kills timed-out commands with exit code 124', async () => {
    const result = await new LocalShell(100).run('sleep 30', signal());
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
  });

  it('group-kills a still-running foreground and its grandchildren on timeout', async () => {
    const started = Date.now();
    const result = await new LocalShell(200).run('(exec -a ghost-shell-probe sleep 8 &) ; sleep 30', signal());
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
    expect(Date.now() - started).toBeLessThan(8000);
    expect(strayProbe('ghost-shell-probe')).toBe(false);
  }, 6000);

  it('group-kills a still-running foreground and its grandchildren on abort', async () => {
    const controller = new AbortController();
    const pending = new LocalShell().run('(exec -a ghost-shell-abort-probe sleep 8 &) ; sleep 30', controller.signal);
    await new Promise(resolve => setTimeout(resolve, 300));
    controller.abort();
    const started = Date.now();
    const result = await pending;
    expect(result.exitCode).toBe(130);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(strayProbe('ghost-shell-abort-probe')).toBe(false);
  }, 5000);

  it('returns when the foreground exits, leaving a launched background app alive', async () => {
    const started = Date.now();
    const result = await new LocalShell().run('(exec -a ghost-shell-launch-probe sleep 8 &)', signal());
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(strayProbe('ghost-shell-launch-probe')).toBe(true);
    try {
      execFileSync('pkill', ['-f', 'ghost-shell-launch-probe'], { timeout: 5000 });
    } catch {
      // Already gone.
    }
    expect(strayProbe('ghost-shell-launch-probe')).toBe(false);
  }, 8000);

  it('stops on abort with exit code 130', async () => {
    const controller = new AbortController();
    const pending = new LocalShell().run('sleep 30', controller.signal);
    controller.abort();
    const result = await pending;
    expect(result.exitCode).toBe(130);
  });

  it('refuses to start when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(new LocalShell().run('echo hi', controller.signal)).rejects.toThrow();
  });
});

describe('shell child environment', () => {
  it('does not inherit provider credentials or shell startup hooks', async () => {
    const { shellEnvironment } = await import('./local-shell');
    const env = shellEnvironment({ META_API_KEY: 'dummy-provider-key', AWS_SECRET_ACCESS_KEY: 'dummy', BASH_ENV: '/tmp/never-source', PATH: '/untrusted', DISPLAY: ':12', HOME: '/tmp/test-home' });
    expect(env).toEqual({ PATH: '/usr/local/bin:/usr/bin:/bin', DISPLAY: ':12', HOME: '/tmp/test-home' });
  });
});
