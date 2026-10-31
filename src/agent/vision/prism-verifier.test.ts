import { describe, expect, it } from 'vitest';
import { PrismVerifier } from './prism-verifier';
import type { DesktopCommand, ScreenObservation } from '../../shared/contracts/desktop';

describe('PrismVerifier (Muse Wonder Supervisor)', () => {
  const verifier = new PrismVerifier();

  const makeObservation = (id: string, image: string): ScreenObservation => ({
    activeWindowId: id,
    image,
    width: 1920,
    height: 1080,
    desktopWidth: 1920,
    desktopHeight: 1080,
    capturedAt: Date.now(),
  });

  it('calculates zero delta for identical screenshots', () => {
    const delta = verifier.calculateVisualDelta('data:image/png;base64,exactsame', 'data:image/png;base64,exactsame');
    expect(delta).toBe(0);
  });

  it('calculates non-zero delta when screens differ', () => {
    const delta = verifier.calculateVisualDelta('data:image/png;base64,AAAA1111', 'data:image/png;base64,BBBB2222');
    expect(delta).toBeGreaterThan(0);
  });

  it('flags stalled_no_change when action produces zero visual delta on same window', () => {
    const pre = makeObservation('win1', 'data:image/png;base64,static_image_data');
    const post = makeObservation('win1', 'data:image/png;base64,static_image_data');
    const clickAction: DesktopCommand = { type: 'click', x: 500, y: 500, button: 'left' };

    const verdict = verifier.verifyTransition(pre, post, clickAction);
    expect(verdict.status).toBe('stalled_no_change');
    expect(verdict.visualDeltaPercent).toBe(0);
    expect(verdict.recoverySuggestion).toBeDefined();
  });

  it('verifies success when visual state updates after a click or type action', () => {
    const pre = makeObservation('win1', 'data:image/png;base64,before_state_long_string_1234567890');
    const post = makeObservation('win1', 'data:image/png;base64,after_state_modal_opened_9876543210');
    const clickAction: DesktopCommand = { type: 'click', x: 200, y: 200, button: 'left' };

    const verdict = verifier.verifyTransition(pre, post, clickAction);
    expect(verdict.status).toBe('verified_success');
    expect(verdict.visualDeltaPercent).toBeGreaterThan(0);
    expect(verdict.summary).toContain('PRISM verified');
  });

  it('confirms window transition when activeWindowId changes', () => {
    const pre = makeObservation('win1', 'data:image/png;base64,appA');
    const post = makeObservation('win2', 'data:image/png;base64,appB');
    const keyAction: DesktopCommand = { type: 'keypress', keys: ['Alt', 'Tab'] };

    const verdict = verifier.verifyTransition(pre, post, keyAction);
    expect(verdict.status).toBe('verified_success');
    expect(verdict.summary).toContain('window transition');
  });

  it('wait actions pass as verified without expecting visual delta', () => {
    const pre = makeObservation('win1', 'data:image/png;base64,same');
    const post = makeObservation('win1', 'data:image/png;base64,same');
    const waitAction: DesktopCommand = { type: 'wait' };

    const verdict = verifier.verifyTransition(pre, post, waitAction);
    expect(verdict.status).toBe('verified_success');
  });
});
