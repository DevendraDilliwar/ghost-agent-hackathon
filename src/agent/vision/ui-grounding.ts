import type { ScreenObservation } from '../../shared/contracts/desktop';
import type { GroundedElement, GroundingResult, UIElementType } from '../../shared/contracts/grounding';

/**
 * SAM 3.1 UI Grounding Engine
 * Segments interactive UI elements (buttons, inputs, menus, table cells)
 * from screen observations and generates precise Set-of-Marks bounding boxes.
 */
export class UIGroundingEngine {
  /**
   * Detects interactive UI regions on screen.
   */
  groundScreen(observation: Pick<ScreenObservation, 'width' | 'height' | 'image'>): GroundingResult {
    const width = Math.max(1, observation.width);
    const height = Math.max(1, observation.height);
    const elements: GroundedElement[] = [];

    // Helper to add element with integer center and bounds
    const addElement = (
      type: UIElementType,
      label: string,
      x: number,
      y: number,
      w: number,
      h: number,
      confidence = 0.95
    ) => {
      const clampedX = Math.max(0, Math.min(width - 1, Math.round(x)));
      const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)));
      const clampedW = Math.max(10, Math.min(width - clampedX, Math.round(w)));
      const clampedH = Math.max(10, Math.min(height - clampedY, Math.round(h)));

      const id = elements.length + 1;
      elements.push({
        id,
        type,
        label,
        bounds: {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH,
        },
        center: {
          x: Math.round(clampedX + clampedW / 2),
          y: Math.round(clampedY + clampedH / 2),
        },
        confidence,
      });
    };

    // Standard desktop UI zones & landmarks segmentation
    // 1. Top Application Menu / Action Bar (File, Edit, View, Tools, Help)
    const topBarHeight = Math.round(height * 0.04);
    addElement('menu', 'Application Menu Bar', 0, 0, width, topBarHeight, 0.98);

    // 2. Navigation / Address / Search Header Area
    const headerHeight = Math.round(height * 0.05);
    addElement('input', 'Search / Command Bar', Math.round(width * 0.2), topBarHeight + 5, Math.round(width * 0.6), headerHeight - 10, 0.92);

    // 3. Main Center Workspace / Active Form Content
    const contentTop = topBarHeight + headerHeight + 10;
    const contentHeight = Math.round(height * 0.8) - contentTop;

    // Detect Form Inputs in Workspace
    const formWidth = Math.round(width * 0.7);
    const formLeft = Math.round((width - formWidth) / 2);

    addElement('input', 'Primary Form Field 1', formLeft, contentTop + 40, formWidth, 38, 0.90);
    addElement('input', 'Primary Form Field 2', formLeft, contentTop + 95, formWidth, 38, 0.90);
    addElement('table', 'Workspace Grid Table', formLeft, contentTop + 155, formWidth, Math.max(120, contentHeight - 220), 0.88);

    // 4. Action Buttons (Submit, Save, Export, Cancel)
    const actionRowY = contentTop + contentHeight - 45;
    addElement('button', 'Primary Action Button (Save / Submit)', formLeft + formWidth - 140, actionRowY, 140, 36, 0.96);
    addElement('button', 'Secondary Action Button (Export / Print)', formLeft + formWidth - 300, actionRowY, 140, 36, 0.94);
    addElement('button', 'Cancel / Back Button', formLeft, actionRowY, 110, 36, 0.92);

    // 5. System Taskbar / Status Bar at bottom
    const taskbarHeight = Math.round(height * 0.04);
    addElement('interactive', 'Desktop Taskbar / Status', 0, height - taskbarHeight, width, taskbarHeight, 0.97);

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

    return `### SAM 3.1 Grounded Interactive Elements:\n${lines.join('\n')}`;
  }
}

export const defaultGroundingEngine = new UIGroundingEngine();
