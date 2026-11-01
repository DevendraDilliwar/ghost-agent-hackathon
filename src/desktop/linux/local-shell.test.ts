import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { LocalShell } from './local-shell';

const signal = () => new AbortController().signal;

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
