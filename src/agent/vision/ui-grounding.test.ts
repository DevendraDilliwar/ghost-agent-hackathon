import { describe, expect, it } from 'vitest';
import { UIGroundingEngine } from './ui-grounding';

describe('UIGroundingEngine (SAM 3.1 Eyes)', () => {
  const engine = new UIGroundingEngine();
  const mockObservation = {
    width: 1920,
    height: 1080,
    image: 'data:image/png;base64,synthetic',
  };

  it('grounds screen and generates numbered tags with valid bounds and centers', () => {
    const result = engine.groundScreen(mockObservation);
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.totalElements).toBe(result.elements.length);

    for (const el of result.elements) {
      expect(el.id).toBeGreaterThan(0);
      expect(el.bounds.x).toBeGreaterThanOrEqual(0);
      expect(el.bounds.y).toBeGreaterThanOrEqual(0);
      expect(el.bounds.width).toBeGreaterThan(0);
      expect(el.bounds.height).toBeGreaterThan(0);
      expect(el.center.x).toBeGreaterThanOrEqual(el.bounds.x);
      expect(el.center.y).toBeGreaterThanOrEqual(el.bounds.y);
      expect(el.confidence).toBeGreaterThan(0);
    }
  });

  it('resolves tag ID to exact center coordinates', () => {
    const result = engine.groundScreen(mockObservation);
    const first = result.elements[0]!;
    const resolved = engine.resolveTag(first.id, result.elements);

    expect(resolved).toEqual(first.center);
    expect(engine.resolveTag(9999, result.elements)).toBe(null);
  });

  it('snaps close clicks to element center to prevent pixel inaccuracy', () => {
    const result = engine.groundScreen(mockObservation);
    const button = result.elements.find(el => el.type === 'button')!;

    // Point inside the bounding box
    const insidePoint = { x: button.bounds.x + 5, y: button.bounds.y + 5 };
    const snapped = engine.snapToNearestElement(insidePoint.x, insidePoint.y, result.elements);
    expect(snapped).toEqual(button.center);

    // Far away point remains untouched
    const farPoint = { x: 50, y: 500 };
    const farSnapped = engine.snapToNearestElement(farPoint.x, farPoint.y, result.elements, 5);
    expect(farSnapped).toEqual(farPoint);
  });

  it('formats elements into clear textual reference for Muse Spark prompt', () => {
    const result = engine.groundScreen(mockObservation);
    const promptText = engine.formatForModelPrompt(result);

    expect(promptText).toContain('SAM 3.1 Grounded Interactive Elements:');
    expect(promptText).toContain('[Tag 1]');
  });
});
