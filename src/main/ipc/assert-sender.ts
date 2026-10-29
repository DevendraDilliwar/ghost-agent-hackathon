import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { isTrustedRenderer } from '../../policy/trusted-renderer';

export function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow, rendererUrl: string, args: unknown[], expectedCount: number): void {
  if (
    args.length !== expectedCount ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !isTrustedRenderer(event.senderFrame.url, rendererUrl)
  ) throw new Error('Rejected desktop bridge request.');
}

export function readRunId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error('Invalid run identifier.');
  return value;
}
