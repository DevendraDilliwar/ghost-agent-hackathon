import { describe, expect, it } from 'vitest';
import { SkillMemory } from './skill-memory';

describe('skill library', () => {
  it('records multi-command wins and rejects singles and duplicates', () => {
    const memory = new SkillMemory();
    expect(memory.record('shared', 'Organize files', ['ls inbox'])).toBeNull();
    const skill = memory.record('shared', 'Organize files', ['ls inbox', 'mkdir -p text && mv inbox/*.txt text/']);
    expect(skill).toMatchObject({ id: 'skill-1', domain: 'shared' });
    expect(skill?.commands).toHaveLength(2);
    expect(memory.record('shared', 'Organize files', ['ls inbox', 'mkdir -p text && mv inbox/*.txt text/'])).toBeNull();
    expect(memory.record('gcp', 'Organize files', ['ls inbox', 'mkdir -p text && mv inbox/*.txt text/'])).not.toBeNull();
  });

  it('suggests domain and keyword matches first', () => {
    const memory = new SkillMemory();
    memory.record('gcp', 'Deploy backend service', ['gcloud run list', 'gcloud run deploy api']);
    memory.record('shared', 'Organize text files', ['ls inbox', 'mkdir -p text && mv inbox/*.txt text/']);
    const [first] = memory.suggest('Organize my text files', 'shared');
    expect(first?.goal).toBe('Organize text files');
    expect(memory.suggest('Unrelated knitting pattern', 'vercel')).toEqual([]);
  });

  it('merges disk records without duplicating known ids', () => {
    const memory = new SkillMemory();
    memory.record('shared', 'Organize files', ['ls inbox', 'mkdir text']);
    memory.merge([
      { id: 'skill-1', name: 'dup', domain: 'shared', commands: ['x', 'y'], goal: 'dup', createdAt: 1 },
      { id: 'skill-9', name: '[shared] old', domain: 'shared', commands: ['df -h /', 'cat disk.txt'], goal: 'Check disk', createdAt: 1 },
    ]);
    expect(memory.serialize().map(skill => skill.id)).toEqual(['skill-1', 'skill-9']);
    expect(memory.record('shared', 'More', ['a', 'b'])?.id).toBe('skill-10');
  });

  it('round-trips through serialize and restore, rejecting damage', () => {
    const memory = new SkillMemory();
    memory.record('shared', 'Organize files', ['ls inbox', 'mkdir text']);
    const restored = SkillMemory.restore(memory.serialize());
    expect(restored.suggest('Organize files', 'shared')).toHaveLength(1);
    expect(() => SkillMemory.restore([{ id: 'skill-1' }])).toThrow('Invalid skill record');
    expect(() => SkillMemory.restore('nope')).toThrow('Invalid skill library');
  });
});
