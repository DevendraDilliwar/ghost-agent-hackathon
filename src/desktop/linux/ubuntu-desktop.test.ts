import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { desktopCapturer } from 'electron';
import { UbuntuDesktop } from './ubuntu-desktop';
import { executeX11Command } from './xdotool';

vi.mock('electron', () => ({
  desktopCapturer: { getSources: vi.fn() },
  screen: { getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0 } }) },
}));
vi.mock('./xdotool', () => ({
  getRootGeometry: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
  runXdotool: vi.fn().mockResolvedValue('100'), executeX11Command: vi.fn().mockResolvedValue(undefined),
}));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

function surface(visible: boolean) {
  let shown = visible;
  return { isDestroyed: () => false, isVisible: () => shown,
    hide: vi.fn(() => { shown = false; }), showInactive: vi.fn(() => { shown = true; }) };
}

describe('desktop observation with floating controls', () => {
  it('hides both Ghost windows before capture and restores them without stealing foreground focus', async () => {
    vi.useFakeTimers();
    const main = surface(true); const controls = surface(true);
    vi.mocked(desktopCapturer.getSources).mockImplementation(async () => {
      expect(main.isVisible()).toBe(false); expect(controls.isVisible()).toBe(false);
      return [{ display_id: '1', thumbnail: { isEmpty: () => false, getSize: () => ({ width: 800, height: 600 }), toPNG: () => Buffer.from('synthetic') } }] as never;
    });
    const desktop = new UbuntuDesktop(main as unknown as BrowserWindow, () => [controls as unknown as BrowserWindow]);
    const pending = desktop.capture(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(250);
    await expect(pending).resolves.toMatchObject({ activeWindowId: '100', width: 800 });
    expect(main.showInactive).toHaveBeenCalledOnce();
    expect(controls.showInactive).toHaveBeenCalledOnce();
  });

  it('restores visible controls after an aborted capture without revealing a previously hidden main window', async () => {
    vi.useFakeTimers();
    const main = surface(false); const controls = surface(true);
    const desktop = new UbuntuDesktop(main as unknown as BrowserWindow, () => [controls as unknown as BrowserWindow]);
    const abort = new AbortController();
    const pending = desktop.capture(abort.signal);
    const rejection = expect(pending).rejects.toThrow();
    abort.abort();
    await rejection;
    expect(main.showInactive).not.toHaveBeenCalled();
    expect(controls.showInactive).toHaveBeenCalledOnce();
    expect(desktopCapturer.getSources).not.toHaveBeenCalled();
    expect(executeX11Command).not.toHaveBeenCalled();
  });
});
