import type { ScreenObservation } from '../../shared/contracts/desktop';
import type { ElementDetector, GroundedElement, GroundingResult } from '../../shared/contracts/grounding';

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<null>(resolve => {
      timer = setTimeout(() => resolve(null), ms);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * UI Grounding Engine (detector seam)
 * Resolves and snaps Set-of-Marks tags from a real detector (AT-SPI on
 * Linux). Without a detector it returns zero elements on purpose: invented
 * boxes would mislead the planner and the overlay.
 */
export class UIGroundingEngine {
  constructor(private readonly detect: ElementDetector = async () => [], private readonly timeoutMs = 2500) {}

  /**
   * Detects interactive UI regions on screen.
   *
   * A slow or failing detector resolves to zero elements — grounding stays
   * optional and never blocks or breaks a run. Never invent boxes from
   * screen proportions: guessed tags misdirect clicks.
   */
  async groundScreen(observation: Pick<ScreenObservation, 'width' | 'height' | 'image'>, signal: AbortSignal = new AbortController().signal): Promise<GroundingResult> {
    let found: GroundedElement[];
    try {
      found = (await withTimeout(this.detect(signal), this.timeoutMs)) ?? [];
    } catch {
      found = [];
    }
    const elements = found
      .filter(element => [element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height].every(Number.isFinite)
        && element.bounds.width >= 3 && element.bounds.height >= 3
        && element.bounds.x < observation.width && element.bounds.y < observation.height
        && element.bounds.x + element.bounds.width > 0 && element.bounds.y + element.bounds.height > 0)
      .slice(0, 80)
      .map((element, index) => ({ ...element, id: index + 1 }));
    return {
      elements,
      totalElements: elements.length,
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
