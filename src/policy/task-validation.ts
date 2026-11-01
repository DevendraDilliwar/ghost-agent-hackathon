import type { RunConfiguration } from '../shared/contracts/task';
import type { DesktopCommand, ScreenObservation } from '../shared/contracts/desktop';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error('Invalid action coordinate or limit.');
  }
  return value;
}

export function validateRunConfiguration(value: unknown): RunConfiguration {
  const input = record(value);
  if (typeof input.goal !== 'string' || !input.goal.trim() || input.goal.trim().length > 2000) {
    throw new Error('Enter a goal between 1 and 2,000 characters.');
  }
  const mode = input.approvalMode ?? 'full_access';
  if (!['ask_approval', 'full_access', 'approve_for_me'].includes(String(mode))) {
    throw new Error('Unsupported approval mode.');
  }
  if (input.screenConsent !== true || input.isolatedEnvironment !== true) {
    throw new Error('Confirm cloud screen processing and the isolated test environment before starting.');
  }
  let resume: RunConfiguration['resume'];
  if (input.resume !== undefined) {
    if (!input.resume || typeof input.resume !== 'object' || Array.isArray(input.resume)) {
      throw new Error('Invalid mission resume reference.');
    }
    const missionId = (input.resume as Record<string, unknown>).missionId;
    if (typeof missionId !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(missionId)) {
      throw new Error('Invalid mission resume reference.');
    }
    resume = { missionId };
  }
  return {
    goal: input.goal.trim(),
    approvalMode: (mode === 'ask_approval' ? 'ask_approval' : 'full_access') as RunConfiguration['approvalMode'],
    maxSteps: integer(input.maxSteps, 1, 100),
    maxMinutes: integer(input.maxMinutes, 1, 60),
    screenConsent: true,
    isolatedEnvironment: true,
    ...(resume ? { resume } : {}),
  };
}

export function validateDesktopCommand(value: unknown, frame: Pick<ScreenObservation, 'width' | 'height'>): DesktopCommand {
  const action = record(value);
  const point = () => ({
    x: integer(action.x, 0, frame.width - 1),
    y: integer(action.y, 0, frame.height - 1),
  });
  switch (action.type) {
    case 'click': {
      const button = action.button ?? 'left';
      if (!['left', 'right', 'wheel', 'back', 'forward'].includes(String(button))) throw new Error('Unsupported mouse button.');
      return { type: 'click', ...point(), button: button as 'left' | 'right' | 'wheel' | 'back' | 'forward' };
    }
    case 'double_click': return { type: 'double_click', ...point() };
    case 'type':
      if (typeof action.text !== 'string' || action.text.length > 4000 || action.text.includes('\0')) {
        throw new Error('Invalid or oversized text action.');
      }
      return { type: 'type', text: action.text };
    case 'keypress':
      if (!Array.isArray(action.keys) || action.keys.length < 1 || action.keys.length > 5 ||
          !action.keys.every(key => typeof key === 'string' && /^[a-zA-Z0-9_]{1,24}$/.test(key))) {
        throw new Error('Unsupported keyboard shortcut.');
      }
      return { type: 'keypress', keys: action.keys as string[] };
    case 'scroll':
      return { type: 'scroll', ...point(), scroll_x: integer(action.scroll_x, -1200, 1200), scroll_y: integer(action.scroll_y, -1200, 1200) };
    case 'wait': return { type: 'wait' };
    case 'screenshot': return { type: 'screenshot' };
    default: throw new Error('The model requested an unsupported desktop action.');
  }
}

export function describeCommand(action: DesktopCommand): string {
  switch (action.type) {
    case 'click': return 'Click ' + action.button + ' at (' + action.x + ', ' + action.y + ')';
    case 'double_click': return 'Double click at (' + action.x + ', ' + action.y + ')';
    case 'type': return 'Type the displayed text into the focused application';
    case 'keypress': return 'Press ' + action.keys.join(' + ');
    case 'scroll': return 'Scroll at (' + action.x + ', ' + action.y + '), horizontal ' + action.scroll_x + ', vertical ' + action.scroll_y;
    case 'wait': return 'Wait for the current screen to settle';
    case 'screenshot': return 'Observe the screen again';
  }
}
