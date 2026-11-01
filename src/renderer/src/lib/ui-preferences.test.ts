import { afterEach, describe, expect, it } from 'vitest';
import { loadDesktopNotifications, loadTextSize, loadThemeMode, saveDesktopNotifications, saveTextSize, saveThemeMode } from './ui-preferences';

const globals = globalThis as Record<string, unknown>;
const realStorage = globals.localStorage;

describe('ui-preferences', () => {
  afterEach(() => {
    globals.localStorage = realStorage;
  });

  it('falls back to defaults without storage', () => {
    globals.localStorage = undefined;
    expect(loadTextSize()).toBe('default');
    expect(loadDesktopNotifications()).toBe(true);
    expect(loadThemeMode()).toBe('dark');
  });

  it('round-trips through storage and rejects unknown values', () => {
    const store = new Map<string, string>();
    globals.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    saveTextSize('large');
    saveDesktopNotifications(false);
    expect(loadTextSize()).toBe('large');
    expect(loadDesktopNotifications()).toBe(false);
    store.set('nomcp.text-size', 'huge');
    expect(loadTextSize()).toBe('default');
    saveThemeMode('light');
    expect(loadThemeMode()).toBe('light');
    store.set('nomcp.theme-mode', 'neon');
    expect(loadThemeMode()).toBe('dark');
  });
});
