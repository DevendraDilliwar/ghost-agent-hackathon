import type { DesktopBridge } from '../../shared/contracts/application';
import type { FloatingControlsBridge } from '../../shared/contracts/controls';

declare global {
  interface Window {
    readonly ghostAgent?: DesktopBridge;
    readonly ghostControls?: FloatingControlsBridge;
  }
}
