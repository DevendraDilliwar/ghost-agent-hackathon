import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { desktopCapturer, screen } from 'electron';
import type { BrowserWindow } from 'electron';
import type { DesktopPort } from '../../agent/ports';
import type { DesktopCommand, DesktopWindow, ScreenObservation } from '../../shared/contracts/desktop';
import { executeX11Command, getRootGeometry, listWindows, runXdotool } from './xdotool';

export class UbuntuDesktop implements DesktopPort {
  private hiddenDepth = 0;
  private restore: BrowserWindow[] = [];
  constructor(private readonly window: BrowserWindow, private readonly otherWindows: () => BrowserWindow[] = () => []) {}

  async preflight(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (process.platform !== 'linux') {
      throw new Error('Desktop control currently requires an Ubuntu/Linux session.');
    }
    this.assertSupportedSession();
    await access('/usr/bin/xdotool', constants.X_OK).catch(() => { throw new Error('Install xdotool in the isolated Ubuntu environment before running tasks.'); });
    await getRootGeometry(signal);
  }

  private assertSupportedSession(): void {
    if (process.env.XDG_SESSION_TYPE !== 'x11') throw new Error('Desktop control requires an isolated Ubuntu X11 session.');
    if (screen.getAllDisplays().length !== 1) throw new Error('Desktop control requires exactly one display.');
  }

  async capture(signal: AbortSignal): Promise<ScreenObservation> {
    this.assertSupportedSession();
    return this.withHiddenWindow(signal, async () => {
      const display = screen.getPrimaryDisplay();
      if (display.bounds.x !== 0 || display.bounds.y !== 0) throw new Error('The display must start at desktop coordinate (0, 0).');
      const geometry = await getRootGeometry(signal);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: geometry.width, height: geometry.height },
      });
      signal.throwIfAborted();
      const source = sources.find(item => item.display_id === String(display.id));
      if (!source || source.thumbnail.isEmpty()) throw new Error('The selected display could not be captured.');
      const size = source.thumbnail.getSize();
      const image = source.thumbnail.toPNG();
      if (image.byteLength > 8_000_000 || size.width < 1 || size.height < 1) throw new Error('The desktop screenshot is empty or too large.');
      const activeWindowId = await runXdotool(['getactivewindow'], signal);
      if (!/^[1-9][0-9]*$/.test(activeWindowId)) throw new Error('The foreground window could not be identified.');
      // Best-effort title: helps the model recognize apps, never blocks capture.
      let activeWindowTitle: string | null = null;
      try {
        const title = await runXdotool(['getwindowname', activeWindowId], signal);
        activeWindowTitle = title.trim().slice(0, 200) || null;
      } catch {
        // Title lookup must never block capture.
      }
      return {
        image: 'data:image/png;base64,' + image.toString('base64'),
        width: size.width, height: size.height, desktopWidth: geometry.width, desktopHeight: geometry.height,
        activeWindowId, capturedAt: Date.now(),
        ...(activeWindowTitle === null ? {} : { activeWindowTitle }),
      };
    });
  }

  async execute(action: DesktopCommand, observation: ScreenObservation, signal: AbortSignal): Promise<void> {
    this.assertSupportedSession();
    await this.withHiddenWindow(signal, async () => {
      await executeX11Command(action, observation, signal);
      await delay(action.type === 'wait' ? 1000 : 200, undefined, { signal });
    });
  }

  async listWindows(signal: AbortSignal): Promise<DesktopWindow[]> {
    return listWindows(signal);
  }

  private async withHiddenWindow<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    if (this.window.isDestroyed()) throw new Error('The Ghost Agent window is closed.');
    if (this.hiddenDepth++ === 0) {
      this.restore = [this.window, ...this.otherWindows()].filter(window => !window.isDestroyed() && window.isVisible());
      for (const window of this.restore) window.hide();
    }
    try {
      await delay(250, undefined, { signal });
      signal.throwIfAborted();
      return await operation();
    } finally {
      if (--this.hiddenDepth === 0) {
        for (const window of this.restore) if (!window.isDestroyed()) window.showInactive();
        this.restore = [];
      }
    }
  }
}
