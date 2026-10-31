import type { ScreenObservation } from '../../shared/contracts/desktop';
import type { GroundedElement, GroundingResult } from '../../shared/contracts/grounding';

/**
 * UI Grounding Engine (detector seam)
 * Resolves and snaps Set-of-Marks tags once a real detector is wired behind
 * this interface. Until then groundScreen returns zero elements on purpose:
 * invented boxes would mislead the planner and the overlay.
 */
export class UIGroundingEngine {
  /**
   * Detects interactive UI regions on screen.
   *
   * No detector is wired yet, so this always returns zero elements. Never
   * invent boxes from screen proportions — guessed tags misdirect clicks.
   * Wire a real provider here (see TECH-007) to enable visual tagging.
   */
  groundScreen(observation: Pick<ScreenObservation, 'width' | 'height' | 'image'>): GroundingResult {
    return {
      elements: [],
      totalElements: 0,
      processedAt: Date.now(),
      annotatedImage: observation.image,
    };
  }

  /**
   * Resolves a tag ID (e.g. tag 4) to its exact center coordinates.
   */
  resolveTag(tagId: number, elements: GroundedElement[]): { x: number; y: number } | null {
    const el = elements.find(item => item.id === tagId);
    return el ? { ...el.center } : null;
  }

  /**
   * Snaps arbitrary coordinates to the nearest interactive element center
   * if within tolerance (defaults to 28px). Prevents edge misclicks.
   */
  snapToNearestElement(x: number, y: number, elements: GroundedElement[], tolerance = 28): { x: number; y: number } {
    for (const el of elements) {
      const b = el.bounds;
      // If point is inside the bounding box, snap directly to center
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return { ...el.center };
      }
      // If within euclidean tolerance of center
      const dx = el.center.x - x;
      const dy = el.center.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance <= tolerance) {
        return { ...el.center };
      }
    }
    return { x, y };
  }

  /**
   * Formats grounded elements into high-density reference text for Muse Spark planning prompt.
   */
  formatForModelPrompt(result: GroundingResult): string {
    if (!result.elements.length) return 'No interactive elements grounded.';

    const lines = result.elements.map(
      el => `[Tag ${el.id}] ${el.type.toUpperCase()}: "${el.label ?? 'Element'}" at center (${el.center.x}, ${el.center.y}) [bounds: ${el.bounds.width}x${el.bounds.height}]`
    );

    return `### Grounded Interactive Elements:\n${lines.join('\n')}`;
  }
}

export const defaultGroundingEngine = new UIGroundingEngine();
