import { describe, expect, it } from 'vitest';
import { CrossTaskMemory } from './cross-task-memory';

describe('cross-task memory', () => {
  it('records escalations once and serves them per domain', () => {
    const memory = new CrossTaskMemory();
    expect(memory.recordMistake('gcp', 'Stuck: billing page. Take control.')).toBe(true);
    expect(memory.recordMistake('gcp', 'Stuck: billing page. Take control.')).toBe(false);
    expect(memory.recordMistake('', 'Stuck')).toBe(false);
    memory.recordMistake('shared', 'Clicks missed the Save button twice.');
    expect(memory.mistakesFor('gcp')).toEqual(['Stuck: billing page. Take control.']);
    expect(memory.mistakesFor('vercel')).toEqual([]);
  });

  it('merges disk records and round-trips with damage rejected', () => {
    const memory = new CrossTaskMemory();
    memory.recordMistake('gcp', 'Old trouble.');
    memory.merge([
      { domain: 'gcp', reason: 'Old trouble.', createdAt: 1 },
      { domain: 'shared', reason: 'Disk lesson.', createdAt: 2 },
    ]);
    expect(memory.serialize().map(entry => entry.reason)).toEqual(['Old trouble.', 'Disk lesson.']);
    const restored = CrossTaskMemory.restore(memory.serialize());
    expect(restored.mistakesFor('shared')).toEqual(['Disk lesson.']);
    expect(() => CrossTaskMemory.restore([{ domain: 'gcp' }])).toThrow('Invalid mistake record');
    expect(() => CrossTaskMemory.restore('nope')).toThrow('Invalid cross-task memory');
  });
});
