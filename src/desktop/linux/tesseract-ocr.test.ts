import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TesseractOcr } from './tesseract-ocr';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const png = 'data:image/png;base64,iVBORw0KGgo=';

function board(output: string, code = 0): void {
  vi.mocked(spawn).mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), kill: vi.fn() });
    queueMicrotask(() => {
      if (output) child.stdout.write(output);
      child.emit('close', code);
    });
    return child as unknown as ReturnType<typeof spawn>;
  });
}

describe('tesseract OCR boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reads screenshot text through a temp PNG without a shell', async () => {
    board('Total 25000\n');
    const text = await new TesseractOcr().readText(png, new AbortController().signal);
    expect(text).toBe('Total 25000\n');
    const invocation = vi.mocked(spawn).mock.calls[0]!;
    expect(invocation[0]).toBe('/usr/bin/tesseract');
    expect(invocation[1]).toEqual([expect.stringContaining('ghost-ocr-'), 'stdout']);
    expect(invocation[2]).toEqual(expect.objectContaining({ shell: false }));
  });

  it('rejects non-PNG input without spawning', async () => {
    await expect(new TesseractOcr().readText('not-an-image', new AbortController().signal)).rejects.toThrow('PNG screenshot');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects when tesseract is missing or fails', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), kill: vi.fn() });
      queueMicrotask(() => child.emit('error', new Error('ENOENT')));
      return child as unknown as ReturnType<typeof spawn>;
    });
    await expect(new TesseractOcr().readText(png, new AbortController().signal)).rejects.toThrow('unavailable');
    board('', 1);
    await expect(new TesseractOcr().readText(png, new AbortController().signal)).rejects.toThrow('unavailable');
  });
});
