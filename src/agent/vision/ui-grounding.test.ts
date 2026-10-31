import { describe, expect, it } from 'vitest';
import { UIGroundingEngine } from './ui-grounding';
import type { GroundedElement } from '../../shared/contracts/grounding';

describe('UIGroundingEngine', () => {
  const engine = new UIGroundingEngine();
  const mockObservation = {
    width: 1920,
    height: 1080,
    image: 'data:image/png;base64,synthetic',
  };
  const stubElements: GroundedElement[] = [
    {
      id: 1, type: 'button', label: 'Save',
      bounds: { x: 100, y: 200, width: 140, height: 36 },
      center: { x: 170, y: 218 }, confidence: 0.95,
    },
    {
      id: 2, type: 'input', label: 'Amount',
      bounds: { x: 100, y: 100, width: 300, height: 38 },
      center: { x: 250, y: 119 }, confidence: 0.9,
    },
  ];

  it('returns zero elements until a real detector is wired (never invents boxes)', () => {
    const result = engine.groundScreen(mockObservation);
    expect(result.elements).toEqual([]);
    expect(result.totalElements).toBe(0);
  });

  it('resolves tag ID to exact center coordinates', () => {
    const resolved = engine.resolveTag(1, stubElements);
    expect(resolved).toEqual(stubElements[0]!.center);
    expect(engine.resolveTag(9999, stubElements)).toBe(null);
  });

  it('snaps close clicks to element center to prevent pixel inaccuracy', () => {
    const button = stubElements[0]!;
    const insidePoint = { x: button.bounds.x + 5, y: button.bounds.y + 5 };
    const snapped = engine.snapToNearestElement(insidePoint.x, insidePoint.y, stubElements);
    expect(snapped).toEqual(button.center);

    const farPoint = { x: 50, y: 500 };
    const farSnapped = engine.snapToNearestElement(farPoint.x, farPoint.y, stubElements, 5);
    expect(farSnapped).toEqual(farPoint);
  });

  it('formats elements into clear textual reference for the planner prompt', () => {
    expect(engine.formatForModelPrompt({ elements: [], totalElements: 0, processedAt: 0 })).toBe(
      'No interactive elements grounded.'
    );
    const promptText = engine.formatForModelPrompt({ elements: stubElements, totalElements: 2, processedAt: 0 });
    expect(promptText).toContain('Grounded Interactive Elements:');
    expect(promptText).toContain('[Tag 1]');
  });
});
