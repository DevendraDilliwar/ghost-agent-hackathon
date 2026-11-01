import { spawn } from 'node:child_process';
import type { DesktopCommand, DesktopWindow, ScreenObservation } from '../../shared/contracts/desktop';

export function runXdotool(args: string[], signal: AbortSignal, input?: string): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/xdotool', args, { shell: false, signal, timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    let settled = false;
    // Name the failing subcommand (never raw output) so a mid-run failure traces to one step.
    const step = args[0] ?? 'input';
    const fail = () => {
      if (!settled) { settled = true; reject(new Error('Desktop input failed or was interrupted. Step: ' + step + '. Check the desktop before continuing.')); }
    };
    child.on('error', fail);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 4096) { child.kill(); fail(); }
    });
    child.stdin.on('error', () => undefined);
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0 || signal.aborted) { fail(); return; }
      settled = true;
      resolve(output.trim());
    });
    child.stdin.end(input);
  });
}

/**
 * Lists visible windows (up to 20) with titles for stall recovery. Windows
 * whose titles cannot be read are skipped; a failed search yields [].
 */
export async function listWindows(signal: AbortSignal): Promise<DesktopWindow[]> {
  let ids: string[];
  try {
    const result = await runXdotool(['search', '--onlyvisible', '--name', '.*'], signal);
    ids = result.split(/[\s\n]+/).filter(id => /^[0-9]+$/.test(id)).slice(0, 20);
  } catch {
    return [];
  }
  const windows: DesktopWindow[] = [];
  for (const id of ids) {
    try {
      const title = await runXdotool(['getwindowname', id], signal);
      const clean = title.trim().slice(0, 120);
      if (clean) windows.push({ id, title: clean });
    } catch {
      // One unreadable window never blocks the inventory.
    }
  }
  return windows;
}

export async function getRootGeometry(signal: AbortSignal): Promise<{ width: number; height: number }> {
  const result = await runXdotool(['getdisplaygeometry'], signal);
  const match = /^(\d+)\s+(\d+)$/.exec(result);
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new Error('Could not determine the X11 desktop geometry.');
  return { width, height };
}

const keyNames: Record<string, string> = {
  CTRL: 'ctrl', CONTROL: 'ctrl', ALT: 'alt', SHIFT: 'shift', SUPER: 'super', META: 'super',
  ENTER: 'Return', RETURN: 'Return', ESC: 'Escape', ESCAPE: 'Escape',
  TAB: 'Tab', SPACE: 'space', BACKSPACE: 'BackSpace', DELETE: 'Delete',
  UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', HOME: 'Home', END: 'End',
  PAGEUP: 'Prior', PAGEDOWN: 'Next',
};

function keyName(key: string): string {
  const known = keyNames[key.toUpperCase()];
  if (known) return known;
  if (/^[a-zA-Z0-9]$/.test(key) || /^F([1-9]|1[0-2])$/.test(key)) return key;
  throw new Error('The requested key is not supported by this input driver.');
}

export async function executeX11Command(action: DesktopCommand, frame: ScreenObservation, signal: AbortSignal): Promise<void> {
  const keys = action.type === 'keypress' ? action.keys.map(keyName).join('+') : null;
  const geometry = await getRootGeometry(signal);
  if (geometry.width !== frame.desktopWidth || geometry.height !== frame.desktopHeight) throw new Error('Desktop geometry changed. Start from a fresh observation.');
  if (!/^[0-9]+$/.test(frame.activeWindowId)) throw new Error('Invalid foreground window.');
  await runXdotool(['windowactivate', '--sync', frame.activeWindowId], signal);
  const point = 'x' in action
    ? [String(Math.min(geometry.width - 1, Math.round(action.x * geometry.width / frame.width))),
      String(Math.min(geometry.height - 1, Math.round(action.y * geometry.height / frame.height)))]
    : [];
  switch (action.type) {
    case 'click': {
      const buttons = { left: '1', wheel: '2', right: '3', back: '8', forward: '9' };
      await runXdotool(['mousemove', '--sync', ...point, 'click', buttons[action.button]], signal);
      break;
    }
    case 'double_click':
      await runXdotool(['mousemove', '--sync', ...point, 'click', '--repeat', '2', '--delay', '100', '1'], signal);
      break;
    case 'type':
      await runXdotool(['type', '--clearmodifiers', '--delay', '0', '--file', '-'], signal, action.text);
      break;
    case 'keypress':
      await runXdotool(['key', '--clearmodifiers', keys!], signal);
      break;
    case 'scroll':
      for (const [delta, negative, positive] of [[action.scroll_y, '4', '5'], [action.scroll_x, '6', '7']] as const) {
        if (delta) await runXdotool(['mousemove', '--sync', ...point, 'click', '--repeat', String(Math.ceil(Math.abs(delta) / 120)), '--delay', '50', delta < 0 ? negative : positive], signal);
      }
      break;
    case 'wait':
    case 'screenshot':
      break;
  }
}
