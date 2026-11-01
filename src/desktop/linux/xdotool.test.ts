import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeX11Command, listWindows, runXdotool } from './xdotool';
import type { ScreenObservation } from '../../shared/contracts/desktop';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const frame: ScreenObservation = {
  image: 'synthetic', width: 960, height: 540, desktopWidth: 1920, desktopHeight: 1080,
  activeWindowId: '100', capturedAt: 1,
};
let geometry = '1920 1080';
let exitCode = 0;
let typed = '';

beforeEach(() => {
  vi.clearAllMocks();
  geometry = '1920 1080';
  exitCode = 0;
  typed = '';
  vi.mocked(spawn).mockImplementation((...parameters: unknown[]) => {
    const args = parameters[1] as string[];
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(), stdin: new PassThrough(), kill: vi.fn(),
    });
    child.stdin.on('data', chunk => { typed += String(chunk); });
    queueMicrotask(() => {
      if (args[0] === 'getdisplaygeometry') child.stdout.write(geometry);
      child.emit('close', exitCode);
    });
    return child as unknown as ReturnType<typeof spawn>;
  });
});

describe('X11 input process boundary', () => {
  it('supplies typed content through stdin without placing it in a shell or process arguments', async () => {
    const text = "sample 'text'; echo $(test)\n";
    const signal = new AbortController().signal;
    await executeX11Command({ type: 'type', text }, frame, signal);
    expect(typed).toBe(text);
    expect(JSON.stringify(vi.mocked(spawn).mock.calls)).not.toContain(text);
    const invocation = vi.mocked(spawn).mock.calls.at(-1)!;
    expect(invocation[0]).toBe('/usr/bin/xdotool');
    expect(invocation[1]).toEqual(['type', '--clearmodifiers', '--delay', '0', '--file', '-']);
    expect(invocation[2]).toEqual(expect.objectContaining({ shell: false, signal, timeout: 5000 }));
  });

  it('maps captured image coordinates into the verified root geometry', async () => {
    await executeX11Command({ type: 'click', x: 100, y: 200, button: 'left' }, frame, new AbortController().signal);
    expect(vi.mocked(spawn).mock.calls.at(-1)?.[1]).toEqual(['mousemove', '--sync', '200', '400', 'click', '1']);
  });

  it('dispatches no input if display geometry changed after observation', async () => {
    geometry = '3840 1080';
    await expect(executeX11Command({ type: 'click', x: 10, y: 10, button: 'left' }, frame, new AbortController().signal)).rejects.toThrow('geometry changed');
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('refuses unsupported key names before starting any process', async () => {
    await expect(executeX11Command({ type: 'keypress', keys: ['exec'] }, frame, new AbortController().signal)).rejects.toThrow('not supported');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('dispatches nothing for an already aborted operation', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => runXdotool(['getdisplaygeometry'], controller.signal)).toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('reports failed input without returning subprocess output to the caller', async () => {
    exitCode = 1;
    await expect(runXdotool(['getdisplaygeometry'], new AbortController().signal)).rejects.toThrow('Desktop input failed or was interrupted.');
  });

  it('lists visible windows with titles for stall recovery', async () => {
    vi.mocked(spawn).mockImplementation((...parameters: unknown[]) => {
      const args = parameters[1] as string[];
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(), stdin: new PassThrough(), kill: vi.fn(),
      });
      queueMicrotask(() => {
        if (args[0] === 'search') child.stdout.write('100\n200\n');
        if (args[0] === 'getwindowname') child.stdout.write(args[1] === '100' ? 'Terminal - ghost' : 'Untitled - Writer');
        child.emit('close', 0);
      });
      return child as unknown as ReturnType<typeof spawn>;
    });
    const windows = await listWindows(new AbortController().signal);
    expect(windows).toEqual([{ id: '100', title: 'Terminal - ghost' }, { id: '200', title: 'Untitled - Writer' }]);
    expect((vi.mocked(spawn).mock.calls[0]![1] as string[]).slice(0, 3)).toEqual(['search', '--onlyvisible', '--name']);
  });

  it('yields no windows when the search fails', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(), stdin: new PassThrough(), kill: vi.fn(),
      });
      queueMicrotask(() => child.emit('close', 1));
      return child as unknown as ReturnType<typeof spawn>;
    });
    await expect(listWindows(new AbortController().signal)).resolves.toEqual([]);
  });
});
