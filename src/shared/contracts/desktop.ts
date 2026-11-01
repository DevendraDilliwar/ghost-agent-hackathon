export type DesktopCommand =
  | { type: 'click'; x: number; y: number; button: 'left' | 'right' | 'wheel' | 'back' | 'forward' }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'keypress'; keys: string[] }
  | { type: 'scroll'; x: number; y: number; scroll_x: number; scroll_y: number }
  | { type: 'wait' }
  | { type: 'screenshot' };

export interface ScreenObservation {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly desktopWidth: number;
  readonly desktopHeight: number;
  readonly activeWindowId: string;
  readonly capturedAt: number;
  /** Foreground window title for model context. Absent when unavailable. Never journaled. */
  readonly activeWindowTitle?: string;
}

export interface RuntimeReadiness {
  readonly ready: boolean;
  readonly modelConfigured: boolean;
  readonly modelVerified: boolean;
  readonly desktopSupported: boolean;
  readonly emergencyStopReady: boolean;
  readonly emergencyStopShortcut: string | null;
  readonly issues: string[];
}
