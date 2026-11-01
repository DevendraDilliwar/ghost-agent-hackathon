import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillStore } from './skill-store';

const skill = {
  id: 'skill-1', name: '[shared] ls inbox', domain: 'shared',
  commands: ['ls inbox', 'mkdir -p text'], goal: 'Organize files', createdAt: 1,
};

describe('skill store', () => {
  it('round-trips the library through one JSON file', async () => {
    const store = new SkillStore(mkdtempSync(join(tmpdir(), 'ghost-skills-')));
    await store.save([skill]);
    await expect(store.load()).resolves.toEqual([skill]);
  });

  it('yields no skills for missing, corrupt, or foreign files', async () => {
    const missing = new SkillStore(mkdtempSync(join(tmpdir(), 'ghost-skills-')));
    await expect(missing.load()).resolves.toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 'ghost-skills-'));
    writeFileSync(join(dir, 'skills.json'), '{not json');
    await expect(new SkillStore(dir).load()).resolves.toEqual([]);
    writeFileSync(join(dir, 'skills.json'), '{"skills":[]}');
    await expect(new SkillStore(dir).load()).resolves.toEqual([]);
  });
});
