import { describe, expect, it } from 'vitest';
import { APP_PROFILES, matchAppProfile } from './app-profiles';

describe('app profiles', () => {
  it.each([
    ['TallyPrime Gold - [Voucher Entry]', 'tally'],
    ['sales.ods - LibreOffice Calc', 'calc'],
    ['Report - LibreOffice Writer', 'writer'],
    ['LIBREOFFICE CALC', 'calc'],
  ])('matches %j to the %s profile', (title, id) => {
    expect(matchAppProfile(title)?.id).toBe(id);
  });

  it.each([['Firefox'], ['Files'], [''], [null], [undefined]])('returns null for unknown or missing titles (%j)', title => {
    expect(matchAppProfile(title)).toBeNull();
  });

  it('keeps every profile small, unique, and actionable', () => {
    const ids = APP_PROFILES.map(profile => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const profile of APP_PROFILES) {
      expect(profile.notes.length).toBeGreaterThan(50);
      expect(profile.notes.length).toBeLessThanOrEqual(600);
      expect(profile.match.length).toBeGreaterThan(0);
    }
    expect(APP_PROFILES.find(profile => profile.id === 'calc')?.notes).toContain('Ctrl+S');
    expect(APP_PROFILES.find(profile => profile.id === 'calc')?.notes).toContain('Next chunk');
    expect(APP_PROFILES.find(profile => profile.id === 'tally')?.notes).toContain('keyboard');
  });
});
