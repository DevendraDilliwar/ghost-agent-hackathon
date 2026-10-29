import { describe, expect, it, vi } from 'vitest';
import { ModelConnection } from './model-connection';

describe('session model connection', () => {
  it('does not report an environment key as verified until the probe succeeds, or expose it in metadata', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const connection = new ModelConnection('private-environment-key', 'muse-spark-1.3', probe);
    expect(connection.info()).toMatchObject({ configured: true, verified: false, source: 'environment' });
    await connection.test(null);
    expect(connection.info().verified).toBe(true);
    expect(JSON.stringify(connection.info())).not.toContain('private-environment-key');
    expect(probe).toHaveBeenCalledWith('private-environment-key', expect.any(AbortSignal));
  });

  it('uses a replacement in memory without writing or returning the credential', async () => {
    const connection = new ModelConnection('', 'muse-spark-1.3', vi.fn().mockResolvedValue(undefined));
    await connection.test('new-session-key');
    expect(connection.getKey()).toBe('new-session-key');
    expect(connection.info()).toEqual({ configured: true, verified: true, source: 'session', model: 'muse-spark-1.3' });
    connection.dispose();
    expect(connection.getKey()).toBe('');
    expect(connection.info().verified).toBe(false);
  });

  it.each([{}, 123, '', 'bad key', 'key\r\nInjected: value', 'x'.repeat(4097)])('rejects malformed input before any request: %j', async candidate => {
    const probe = vi.fn();
    const connection = new ModelConnection('', 'muse-spark-1.3', probe);
    await expect(connection.test(candidate)).rejects.toThrow('Enter a Meta API key');
    expect(probe).not.toHaveBeenCalled();
  });

  it('does not retain a verified status after a failed probe', async () => {
    const probe = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Authentication failed'));
    const connection = new ModelConnection('key', 'muse-spark-1.3', probe);
    await connection.test(null);
    await expect(connection.test(null)).rejects.toThrow('Authentication failed');
    expect(connection.info().verified).toBe(false);
  });

  it('rejects overlapping probes and invalidates late success after disposal', async () => {
    let finish!: () => void;
    const connection = new ModelConnection('key', 'muse-spark-1.3', () => new Promise<void>(resolve => { finish = resolve; }));
    const pending = connection.test(null);
    await expect(connection.test('other-key')).rejects.toThrow('already running');
    connection.dispose();
    finish();
    await expect(pending).rejects.toThrow();
    expect(connection.info().verified).toBe(false);
    expect(connection.getKey()).toBe('');
  });
});
