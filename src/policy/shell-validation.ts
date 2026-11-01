/**
 * Terminal command policy for run_shell steps.
 *
 * The agent runs on the user's own machine, so the shell is powerful by
 * design — but privilege escalation, disk destruction, power control, and
 * piped remote-code execution are never legitimate agent work. This validator
 * rejects those shapes before anything spawns. Pure string checks, no I/O.
 */

/** Binaries that are never valid as the leading command of a segment. */
const LEADING_BLOCKED = ['sudo', 'su', 'doas', 'run0', 'mkfs', 'dd', 'fdisk', 'parted', 'shutdown', 'reboot', 'poweroff', 'halt'];

/** rm -rf targets that would destroy the system or the home directory. */
const RM_ROOT_TARGETS = ['/', '/*', '~', '~/', '$HOME', '$HOME/'];

function segments(command: string): string[] {
  return command.split(/;|&&|\|\||\|/).map(part => part.trim()).filter(Boolean);
}

function leadingBinary(segment: string): string {
  const cleaned = segment
    .replace(/^([A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '')
    .replace(/^(env\s+|nice\s+|nohup\s+|timeout\s+\S+\s+|command\s+|builtin\s+)+/, '').trim();
  const first = cleaned.split(/\s+/, 1)[0] ?? '';
  return first.split('/').pop() ?? '';
}

function isBlockedBinary(binary: string): boolean {
  // Exact match plus dotted variants (mkfs.ext4) so renames do not slip past.
  return LEADING_BLOCKED.some(name => binary === name || binary.startsWith(name + '.'));
}

function hasRecursiveForce(segment: string): boolean {
  return /(^|\s)rm\s+.*-[a-zA-Z]*r[a-zA-Z]*f/.test(segment) || /(^|\s)rm\s+.*-[a-zA-Z]*f[a-zA-Z]*r/.test(segment);
}

function targetsRoot(segment: string): boolean {
  const withoutFlags = segment.replace(/(^|\s)rm\s+(--[a-z-]+|-[a-zA-Z]+|\s)+/, ' ').trim();
  const targets = withoutFlags.split(/\s+/).filter(part => !part.startsWith('-'));
  return targets.some(target => RM_ROOT_TARGETS.includes(target) || target === '/' || target.endsWith('/*'));
}

export function validateShellCommand(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000 || value.includes('\0')) {
    throw new Error('Invalid terminal command.');
  }
  const command = value.trim();
  if (command.includes(':(){')) throw new Error('Blocked terminal command: fork bombs are never allowed.');
  if (/\|\s*(bash|sh|zsh|fish|dash|ksh)\b/.test(command)) {
    throw new Error('Blocked terminal command: piping into a shell interpreter is never allowed.');
  }
  for (const segment of segments(command)) {
    const binary = leadingBinary(segment);
    if (isBlockedBinary(binary)) {
      throw new Error('Blocked terminal command: "' + binary + '" is never allowed.');
    }
    if (binary === 'rm' && hasRecursiveForce(segment) && targetsRoot(segment)) {
      throw new Error('Blocked terminal command: recursive forced removal outside the working tree is never allowed.');
    }
    if (binary === 'chmod' && /(^|\s)-R\b/.test(segment) && /(^|\s)(\/|\/\*|~|\$HOME)(\s|$)/.test(segment)) {
      throw new Error('Blocked terminal command: recursive permission changes outside the working tree are never allowed.');
    }
  }
  return command;
}
