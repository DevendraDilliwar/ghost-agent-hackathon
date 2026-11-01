import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVAL_TASKS, readOdtText } from './eval-tasks';

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ghost-eval-test-'));
}

describe('eval tasks', () => {
  it('declares five bounded benchmark tasks', () => {
    expect(EVAL_TASKS.map(task => task.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
    for (const task of EVAL_TASKS) {
      expect(task.maxSteps).toBeLessThanOrEqual(25);
      expect(task.maxMinutes).toBeLessThanOrEqual(8);
      expect(task.goal('/tmp/x')).toContain('/tmp/x');
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
    const deps = { readOdtText: () => xml };
    for (const task of [EVAL_TASKS[1]!, EVAL_TASKS[3]!, EVAL_TASKS[4]!]) task.setup(root);
    writeFileSync(join(root, 't2', 'note.odt'), 'fake-bytes');
    writeFileSync(join(root, 't4', 'disk.txt'), 'Filesystem Size Used\n/dev/sda 20G 5G\n');
    writeFileSync(join(root, 't4', 'disk-report.odt'), 'fake-bytes');
    writeFileSync(join(root, 't5', 'sum.ods'), 'fake-bytes');
    expect(EVAL_TASKS[1]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[3]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[4]!.verify(root, deps).pass).toBe(true);
    expect(EVAL_TASKS[1]!.verify(root, { readOdtText: () => 'empty doc' }).pass).toBe(false);
    writeFileSync(join(root, 't4', 'disk.txt'), 'not df output\n');
    expect(EVAL_TASKS[3]!.verify(root, deps).pass).toBe(false);
  });

  it('readOdtText returns null for missing files', () => {
    expect(readOdtText('/nonexistent/file.odt')).toBeNull();
  });
});
