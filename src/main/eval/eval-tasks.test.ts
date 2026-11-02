import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVAL_TASKS, clearStaleOffice, readOdtText } from './eval-tasks';

const probeAlive = (marker: string): boolean => {
  try {
    execFileSync('pgrep', ['-f', marker], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ghost-eval-test-'));
}

describe('eval tasks', () => {
  it('declares six bounded benchmark tasks', () => {
    expect(EVAL_TASKS.map(task => task.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
    for (const task of EVAL_TASKS) {
      expect(task.maxSteps).toBeLessThanOrEqual(25);
      expect(task.maxMinutes).toBeLessThanOrEqual(8);
      expect(task.goal('/tmp/x')).toContain('/tmp/x');
    }
  });

  it('clearStaleOffice kills only its pattern and never throws on zero matches', async () => {
    const marker = 'ghost-stale-office-probe';
    const child = spawn('/bin/bash', ['-c', `exec -a ${marker} sleep 30`], { stdio: 'ignore' });
    try {
      let found = false;
      for (let i = 0; i < 20 && !found; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        found = probeAlive(marker);
      }
      expect(found).toBe(true);
      expect(() => clearStaleOffice(marker)).not.toThrow();
      expect(probeAlive(marker)).toBe(false);
      expect(() => clearStaleOffice('ghost-no-such-office-probe')).not.toThrow();
    } finally {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  });

  it('fails verification on a fresh root (verifiers are not vacuous)', () => {
    const root = freshRoot();
    for (const task of EVAL_TASKS) {
      task.setup(root);
      expect(task.verify(root).pass, task.id).toBe(false);
    }
  });

  it('passes T1 after simulated terminal work', () => {
    const root = freshRoot();
    const task = EVAL_TASKS[0]!;
    task.setup(root);
    writeFileSync(join(root, 't1', 'hello.txt'), 'hello eval\n');
    expect(task.verify(root)).toMatchObject({ pass: true });
    writeFileSync(join(root, 't1', 'hello.txt'), 'wrong\n');
    expect(task.verify(root).pass).toBe(false);
  });

  it('passes T3 after simulated file moves', () => {
    const root = freshRoot();
    const task = EVAL_TASKS[2]!;
    task.setup(root);
    mkdirSync(join(root, 't3', 'text'), { recursive: true });
    renameSync(join(root, 't3', 'inbox', 'a.txt'), join(root, 't3', 'text', 'a.txt'));
    renameSync(join(root, 't3', 'inbox', 'b.txt'), join(root, 't3', 'text', 'b.txt'));
    expect(task.verify(root)).toMatchObject({ pass: true });
  });

  it('passes doc tasks with stubbed office content', () => {
    const root = freshRoot();
    const xml = '<office:document><text:p>Eval Note</text:p><text:p>20G disk</text:p><table:formula>oooc:=SUM(A1:A3)</table:formula></office:document>';
    const deps = {
      readOdtEntry: (file: string, entry: string) => entry === 'content.xml' ? xml
        : file.endsWith('.ods') ? 'application/vnd.oasis.opendocument.spreadsheet' : 'application/vnd.oasis.opendocument.text',
    };
    for (const task of [EVAL_TASKS[1]!, EVAL_TASKS[3]!, EVAL_TASKS[4]!]) task.setup(root);
    writeFileSync(join(root, 't2', 'note.odt'), 'fake-bytes');
    writeFileSync(join(root, 't4', 'disk.txt'), 'Filesystem Size Used\n/dev/sda 20G 5G\n');
    writeFileSync(join(root, 't4', 'disk-report.odt'), 'fake-bytes');
    writeFileSync(join(root, 't5', 'sum.ods'), 'fake-bytes');
    expect(EVAL_TASKS[1]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[3]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[4]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[1]!.verify(root, { readOdtEntry: () => 'empty doc' }).pass).toBe(false);
    writeFileSync(join(root, 't4', 'disk.txt'), 'not df output\n');
    expect(EVAL_TASKS[3]!.verify(root, deps).pass).toBe(false);
  });

  it('rejects office files with missing or wrong mimetype even when content matches', () => {
    const root = freshRoot();
    const xml = '<office:document><text:p>Eval Note</text:p></office:document>';
    EVAL_TASKS[1]!.setup(root);
    writeFileSync(join(root, 't2', 'note.odt'), 'fake-bytes');
    const missing = EVAL_TASKS[1]!.verify(root, { readOdtEntry: (_file: string, entry: string) => entry === 'content.xml' ? xml : null });
    expect(missing.pass).toBe(false);
    expect(missing.detail).toContain('mimetype');
    const wrong = EVAL_TASKS[1]!.verify(root, { readOdtEntry: (_file: string, entry: string) => entry === 'content.xml' ? xml : 'application/zip' });
    expect(wrong.pass).toBe(false);
    expect(wrong.detail).toContain('fabricated');
  });

  it('passes T6 after simulated sorting and rejects a wrong manifest', () => {
    const root = freshRoot();
    const task = EVAL_TASKS[5]!;
    task.setup(root);
    for (const dir of ['txt', 'csv', 'log']) mkdirSync(join(root, 't6', dir), { recursive: true });
    for (const file of readdirSync(join(root, 't6', 'inbox'))) {
      const ext = file.endsWith('.txt') ? 'txt' : file.endsWith('.csv') ? 'csv' : 'log';
      renameSync(join(root, 't6', 'inbox', file), join(root, 't6', ext, file));
    }
    writeFileSync(join(root, 't6', 'manifest.txt'), 'txt: 6\ncsv: 3\nlog: 3\n');
    expect(task.verify(root)).toMatchObject({ pass: true });
    writeFileSync(join(root, 't6', 'manifest.txt'), 'txt: 5\ncsv: 3\nlog: 3\n');
    expect(task.verify(root).pass).toBe(false);
  });

  it('readOdtText returns null for missing files', () => {
    expect(readOdtText('/nonexistent/file.odt')).toBeNull();
  });
});
