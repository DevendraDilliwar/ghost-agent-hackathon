import type { DesktopSession } from '../shared/contracts/application';

export function getDesktopSession(sessionType: string | undefined): DesktopSession {
  if (sessionType === 'x11' || sessionType === 'wayland') {
    return sessionType;
  }

  return 'unknown';
}
