export type UIElementType = 'button' | 'input' | 'menu' | 'dialog' | 'table' | 'icon' | 'link' | 'interactive';

export interface GroundedElement {
  readonly id: number; // 1-indexed Tag number (e.g. 1, 2, 3...)
  readonly type: UIElementType;
  readonly label?: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly center: {
    readonly x: number;
    readonly y: number;
  };
  readonly confidence: number;
}

export interface GroundingResult {
  readonly elements: GroundedElement[];
  readonly totalElements: number;
  readonly processedAt: number;
  readonly annotatedImage?: string;
}
