import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface EvalVerdict {
  readonly pass: boolean;
  readonly detail: string;
}

export interface EvalTaskDeps {
  /** Reads a named zip entry from an .odt/.ods file. Null when unreadable. Injectable for tests. */
  readOdtEntry?: (file: string, entry: string) => string | null;
}

export interface EvalTask {
  readonly id: string;
  readonly name: string;
  readonly kind: 'terminal' | 'gui' | 'mixed';
  readonly maxSteps: number;
  readonly maxMinutes: number;
  goal(root: string): string;
  setup(root: string): void;
  verify(root: string, deps?: EvalTaskDeps): EvalVerdict;
}

/** Extracts a named zip entry from a LibreOffice file. Null when unzip is missing or the file is unreadable. */
export function readOdtEntry(file: string, entry: string): string | null {
  try {
    return execFileSync('unzip', ['-p', file, entry], { maxBuffer: 4 * 1024 * 1024, timeout: 10_000 }).toString();
  } catch {
    return null;
  }
}

/** Extracts content.xml from a LibreOffice file. Null when unzip is missing or the file is unreadable. */
export function readOdtText(file: string): string | null {
  return readOdtEntry(file, 'content.xml');
}

function freshDir(root: string, name: string): string {
  const dir = join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function odtVerdict(file: string, needle: RegExp | string, expectedMimetype: string, deps?: EvalTaskDeps): EvalVerdict {
  if (!existsSync(file)) return { pass: false, detail: 'Missing file: ' + file };
  const size = statSync(file).size;
  const readEntry = deps?.readOdtEntry ?? readOdtEntry;
  const text = readEntry(file, 'content.xml');
  if (text === null) {
    return size > 2000
      ? { pass: true, detail: 'Exists (' + size + ' bytes); content unreadable without unzip, size-only check.' }
      : { pass: false, detail: 'Too small (' + size + ' bytes) and content unreadable without unzip.' };
  }
  const found = typeof needle === 'string' ? text.includes(needle) : needle.test(text);
  if (!found) return { pass: false, detail: 'Exists (' + size + ' bytes) but expected content is missing.' };
  // A hand-zipped file can carry the right XML but the wrong identity: only a
  // real LibreOffice document ships its mimetype entry at the zip root.
  const mimetype = readEntry(file, 'mimetype');
  if (mimetype === null) return { pass: false, detail: 'Content matches but the mimetype entry is missing — not a real LibreOffice file.' };
  const type = mimetype.trim();
  return type === expectedMimetype
    ? { pass: true, detail: 'Exists (' + size + ' bytes) with expected content.' }
    : { pass: false, detail: 'Content matches but mimetype is "' + type.slice(0, 80) + '" — fabricated office file?' };
}

const terminalEcho: EvalTask = {
  id: 'T1', name: 'terminal-echo', kind: 'terminal', maxSteps: 6, maxMinutes: 2,
  goal: root => 'Using the terminal, create the folder ' + join(root, 't1') + ' and write exactly "hello eval" into ' + join(root, 't1', 'hello.txt'),
  setup: root => { freshDir(root, 't1'); },
  verify: root => {
    const file = join(root, 't1', 'hello.txt');
    if (!existsSync(file)) return { pass: false, detail: 'Missing file: ' + file };
    const content = readFileSync(file, 'utf8').trim();
    return content === 'hello eval'
      ? { pass: true, detail: 'File contains exactly "hello eval".' }
      : { pass: false, detail: 'Unexpected content: ' + JSON.stringify(content.slice(0, 100)) };
  },
};

const writerDoc: EvalTask = {
  id: 'T2', name: 'writer-doc', kind: 'gui', maxSteps: 15, maxMinutes: 5,
  goal: root => 'Open LibreOffice Writer, write a document with the title "Eval Note" on the first line and "The quick brown fox." on the second line, and save it as ' + join(root, 't2', 'note.odt') + ' (create the folder first if needed)',
  setup: root => { freshDir(root, 't2'); },
  verify: (root, deps) => odtVerdict(join(root, 't2', 'note.odt'), 'Eval Note', 'application/vnd.oasis.opendocument.text', deps),
};

const fileOrganize: EvalTask = {
  id: 'T3', name: 'file-organize', kind: 'mixed', maxSteps: 10, maxMinutes: 3,
  goal: root => 'Move the .txt files from ' + join(root, 't3', 'inbox') + ' into a new folder ' + join(root, 't3', 'text') + ', leaving every other file in place',
  setup: root => {
    const inbox = freshDir(root, join('t3', 'inbox'));
    rmSync(join(root, 't3', 'text'), { recursive: true, force: true });
    writeFileSync(join(inbox, 'a.txt'), 'a\n');
    writeFileSync(join(inbox, 'b.txt'), 'b\n');
    writeFileSync(join(inbox, 'c.log'), 'c\n');
  },
  verify: root => {
    const inbox = join(root, 't3', 'inbox');
    const text = join(root, 't3', 'text');
    const moved = existsSync(join(text, 'a.txt')) && existsSync(join(text, 'b.txt'));
    const kept = existsSync(join(inbox, 'c.log')) && !existsSync(join(inbox, 'a.txt')) && !existsSync(join(inbox, 'b.txt'));
    if (moved && kept) return { pass: true, detail: '.txt files moved, c.log left in place.' };
    return { pass: false, detail: 'moved=' + moved + ' kept=' + kept };
  },
};

const mixedReport: EvalTask = {
  id: 'T4', name: 'mixed-report', kind: 'mixed', maxSteps: 20, maxMinutes: 6,
  goal: root => 'Run `df -h /` in the terminal and save its output to ' + join(root, 't4', 'disk.txt') +
    ', then create a LibreOffice Writer document that mentions the filesystem size from that output and save it as ' + join(root, 't4', 'disk-report.odt'),
  setup: root => { freshDir(root, 't4'); },
  verify: (root, deps) => {
    const disk = join(root, 't4', 'disk.txt');
    if (!existsSync(disk)) return { pass: false, detail: 'Missing file: ' + disk };
    if (!readFileSync(disk, 'utf8').includes('Filesystem')) return { pass: false, detail: 'disk.txt is not df output.' };
    return odtVerdict(join(root, 't4', 'disk-report.odt'), /[0-9]+(\.[0-9]+)?\s*G/, 'application/vnd.oasis.opendocument.text', deps);
  },
};

const calcSum: EvalTask = {
  id: 'T5', name: 'calc-sum', kind: 'gui', maxSteps: 25, maxMinutes: 8,
  goal: root => 'Open LibreOffice Calc, enter 10 in cell A1, 20 in A2, 30 in A3, put a SUM formula adding them in A4, and save as ' + join(root, 't5', 'sum.ods') + ' (create the folder first if needed)',
  setup: root => { freshDir(root, 't5'); },
  verify: (root, deps) => odtVerdict(join(root, 't5', 'sum.ods'), 'SUM(', 'application/vnd.oasis.opendocument.spreadsheet', deps),
};

const archiveWeeks: EvalTask = {
  id: 'T6', name: 'archive-weeks', kind: 'mixed', maxSteps: 25, maxMinutes: 8,
  goal: root => 'Sort the files in ' + join(root, 't6', 'inbox') + ' by extension into new folders ' +
    join(root, 't6', 'txt') + ', ' + join(root, 't6', 'csv') + ' and ' + join(root, 't6', 'log') +
    ', then write ' + join(root, 't6', 'manifest.txt') + ' listing each folder name with its file count, one per line like "txt: 6"',
  setup: root => {
    const inbox = freshDir(root, join('t6', 'inbox'));
    for (const dir of ['txt', 'csv', 'log']) rmSync(join(root, 't6', dir), { recursive: true, force: true });
    rmSync(join(root, 't6', 'manifest.txt'), { force: true });
    for (let week = 1; week <= 6; week++) writeFileSync(join(inbox, 'week' + week + '.txt'), 'week ' + week + '\n');
    for (let file = 1; file <= 3; file++) writeFileSync(join(inbox, 'data' + file + '.csv'), 'a,b\n');
    for (let file = 1; file <= 3; file++) writeFileSync(join(inbox, 'note' + file + '.log'), 'log\n');
  },
  verify: root => {
    const expected: Record<string, number> = { txt: 6, csv: 3, log: 3 };
    for (const [dir, count] of Object.entries(expected)) {
      const folder = join(root, 't6', dir);
      if (!existsSync(folder)) return { pass: false, detail: 'Missing folder: ' + folder };
      const files = readdirSync(folder).filter(file => file.endsWith('.' + dir));
      if (files.length !== count) return { pass: false, detail: folder + ' holds ' + files.length + ' .' + dir + ' files, expected ' + count + '.' };
    }
    if (readdirSync(join(root, 't6', 'inbox')).length !== 0) return { pass: false, detail: 'Inbox is not empty.' };
    const manifest = join(root, 't6', 'manifest.txt');
    if (!existsSync(manifest)) return { pass: false, detail: 'Missing file: ' + manifest };
    const text = readFileSync(manifest, 'utf8');
    for (const [dir, count] of Object.entries(expected)) {
      if (!text.includes(dir + ': ' + count)) return { pass: false, detail: 'manifest.txt is missing "' + dir + ': ' + count + '".' };
    }
    return { pass: true, detail: '12 files sorted into 3 folders with a correct manifest.' };
  },
};

export const EVAL_TASKS: readonly EvalTask[] = [terminalEcho, writerDoc, fileOrganize, mixedReport, calcSum, archiveWeeks];
