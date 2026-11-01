export type TextSize = 'compact' | 'default' | 'large';
export type ThemeMode = 'dark' | 'light';

const TEXT_SIZE_KEY = 'nomcp.text-size';
const NOTIFICATIONS_KEY = 'nomcp.desktop-notifications';
const THEME_KEY = 'nomcp.theme-mode';
const TEXT_SIZES: readonly TextSize[] = ['compact', 'default', 'large'];
const THEMES: readonly ThemeMode[] = ['dark', 'light'];

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadTextSize(): TextSize {
  const raw = storage()?.getItem(TEXT_SIZE_KEY);
  return raw && (TEXT_SIZES as readonly string[]).includes(raw) ? (raw as TextSize) : 'default';
}

export function saveTextSize(value: TextSize): void {
  try {
    storage()?.setItem(TEXT_SIZE_KEY, value);
  } catch {
    // Preferences are best-effort; the app works without persistence.
  }
}

export function loadDesktopNotifications(): boolean {
  return storage()?.getItem(NOTIFICATIONS_KEY) !== 'off';
}

export function saveDesktopNotifications(enabled: boolean): void {
  try {
    storage()?.setItem(NOTIFICATIONS_KEY, enabled ? 'on' : 'off');
  } catch {
    // Preferences are best-effort; the app works without persistence.
  }
}

export function loadThemeMode(): ThemeMode {
  const raw = storage()?.getItem(THEME_KEY);
  return raw && (THEMES as readonly string[]).includes(raw) ? (raw as ThemeMode) : 'dark';
}

export function saveThemeMode(value: ThemeMode): void {
  try {
    storage()?.setItem(THEME_KEY, value);
  } catch {
    // Preferences are best-effort; the app works without persistence.
  }
}
