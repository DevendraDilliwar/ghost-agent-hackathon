import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OcrPort } from '../../agent/ports';

/**
 * Tesseract OCR spot-checks (free, local). Reads a screenshot data URL
 * through a temp PNG so typed text can be confirmed without a paid judge
 * call. Missing binaries, bad input, and oversized output reject — the
 * caller always falls back to the model judge.
 */
export class TesseractOcr implements OcrPort {
  async readText(image: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const payload = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(image)?.[1];
    if (!payload) throw new Error('OCR needs a PNG screenshot.');
    const file = join(tmpdir(), 'ghost-ocr-' + randomUUID() + '.png');
    await writeFile(file, Buffer.from(payload.replace(/\s/g, ''), 'base64'));
    try {
      return await this.recognize(file, signal);
    } finally {
      await unlink(file).catch(() => undefined);
    }
  }

  private recognize(file: string, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/tesseract', [file, 'stdout'], { shell: false, signal, timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] });
      let output = '';
      let settled = false;
      const fail = () => {
        if (!settled) { settled = true; reject(new Error('Local OCR is unavailable.')); }
      };
      child.on('error', fail);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        if (output.length > 32_768) { child.kill(); fail(); }
      });
      child.on('close', code => {
        if (settled) return;
        if (code !== 0 || signal.aborted) { fail(); return; }
        settled = true;
        resolve(output);
      });
    });
  }
}
