export interface SkillRecord {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly commands: readonly string[];
  readonly goal: string;
  readonly createdAt: number;
}

const maxSkills = 50;
const maxCommands = 8;
const maxCommand = 500;

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
}

/**
 * Skill library — sequences that won before, suggested when they fit again.
 *
 * Only multi-command shell sequences from judge-confirmed phases are
 * recorded, so a skill is proven work, never a guess. Desktop clicks stay
 * out: raw coordinates do not survive a changed screen.
 */
export class SkillMemory {
  private readonly skills: SkillRecord[] = [];
  private counter = 0;

  constructor(initial: readonly SkillRecord[] = [], private readonly now: () => number = Date.now) {
    for (const record of initial) {
      this.skills.push({ ...record, commands: [...record.commands] });
      const match = /^skill-([0-9]+)$/.exec(record.id);
      if (match?.[1]) this.counter = Math.max(this.counter, Number(match[1]));
    }
  }

  /** Records a won sequence. Null when too short, duplicate, or invalid. */
  record(domain: string, goal: string, commands: readonly string[]): SkillRecord | null {
    const clean = commands.map(cmd => cmd.trim())
      .filter(cmd => cmd && cmd.length <= maxCommand && !cmd.includes('\0'))
      .slice(0, maxCommands);
    if (clean.length < 2 || !domain.trim() || !goal.trim()) return null;
    if (this.skills.some(skill => skill.domain === domain && skill.commands.length === clean.length &&
      skill.commands.every((cmd, index) => cmd === clean[index]))) return null;
    if (this.skills.length >= maxSkills) this.skills.shift();
    const record: SkillRecord = {
      id: 'skill-' + ++this.counter, name: '[' + domain + '] ' + clean[0]!.slice(0, 40),
      domain, commands: clean, goal: goal.slice(0, 200), createdAt: this.now(),
    };
    this.skills.push(record);
    return { ...record, commands: [...record.commands] };
  }

  /** Suggests up to `limit` skills matching the goal and phase domain. */
  suggest(goal: string, domain: string | null, limit = 2): SkillRecord[] {
    const wanted = words(goal);
    return this.skills
      .map(skill => {
        const haystack = words(skill.goal + ' ' + skill.commands.join(' '));
        let shared = 0;
        for (const word of wanted) if (haystack.has(word)) shared += 1;
        return { skill, score: (domain && skill.domain === domain ? 2 : 0) + shared };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => ({ ...entry.skill, commands: [...entry.skill.commands] }));
  }

  /** Merges disk records in, skipping ids already known. */
  merge(records: readonly SkillRecord[]): void {
    const known = new Set(this.skills.map(skill => skill.id));
    for (const record of records) {
      if (known.has(record.id)) continue;
      known.add(record.id);
      if (this.skills.length >= maxSkills) this.skills.shift();
      this.skills.push({ ...record, commands: [...record.commands] });
      const match = /^skill-([0-9]+)$/.exec(record.id);
      if (match?.[1]) this.counter = Math.max(this.counter, Number(match[1]));
    }
  }

  serialize(): SkillRecord[] {
    return this.skills.map(skill => ({ ...skill, commands: [...skill.commands] }));
  }

  static restore(records: unknown): SkillMemory {
    if (!Array.isArray(records)) throw new Error('Invalid skill library.');
    const clean: SkillRecord[] = [];
    for (const entry of records) {
      if (!entry || typeof entry !== 'object') throw new Error('Invalid skill record.');
      const record = entry as Record<string, unknown>;
      const commands = Array.isArray(record.commands) ? record.commands : [];
      if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' ||
        typeof record.domain !== 'string' || !record.domain.trim() || !commands.length ||
        commands.some(cmd => typeof cmd !== 'string' || !cmd.trim()) ||
        typeof record.goal !== 'string' || typeof record.createdAt !== 'number') {
        throw new Error('Invalid skill record.');
      }
      clean.push({
        id: record.id, name: record.name.slice(0, 80), domain: record.domain,
        commands: commands.filter((cmd): cmd is string => typeof cmd === 'string').map(cmd => cmd.slice(0, maxCommand)),
        goal: record.goal.slice(0, 200), createdAt: record.createdAt,
      });
    }
    return new SkillMemory(clean);
  }
}
