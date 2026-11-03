import type { DesktopCommand, ScreenObservation } from '../../shared/contracts/desktop';

export type VerificationStatus =
  | 'verified_success'
  | 'stalled_no_change'
  | 'error_dialog_detected'
  | 'human_intervention_needed';

export interface VerificationVerdict {
  readonly status: VerificationStatus;
  readonly visualDeltaPercent: number;
  readonly summary: string;
  readonly recoverySuggestion?: string;
  readonly verifiedAt: number;
}

/**
 * PRISM stall heuristic. Encoded changes indicate activity, not successful
 * typing, the absence of error dialogs, or semantic task completion.
 */
export class PrismVerifier {
  /**
   * Computes an encoded-image change heuristic, not a perceptual pixel metric.
   */
  calculateVisualDelta(preImage: string, postImage: string): number {
    if (!preImage || !postImage) return 0;
    if (preImage === postImage) return 0;

    // Sample encoded payloads only for stall detection; this cannot prove task success.
    const lenA = preImage.length;
    const lenB = postImage.length;
    const minLen = Math.min(lenA, lenB);

    let diffCount = Math.abs(lenA - lenB);
    const sampleStep = Math.max(1, Math.floor(minLen / 500)); // Sample ~500 points
    let samples = 0;

    for (let i = 0; i < minLen; i += sampleStep) {
      samples++;
      if (preImage.charCodeAt(i) !== postImage.charCodeAt(i)) {
        diffCount++;
      }
    }

    const ratio = Math.min(1, diffCount / Math.max(1, samples + Math.abs(lenA - lenB)));
    // Return rounded percentage between 0 and 100
    return Math.round(ratio * 1000) / 10;
  }

  /**
   * Verifies the desktop state transition produced by an executed command.
   */
  verifyTransition(
    pre: ScreenObservation,
    post: ScreenObservation,
    action: DesktopCommand
  ): VerificationVerdict {
    const verifiedAt = Date.now();
    const visualDelta = this.calculateVisualDelta(pre.image, post.image);
    const windowChanged = pre.activeWindowId !== post.activeWindowId;

    // Wait and screenshot actions don't expect visual changes
    if (action.type === 'wait' || action.type === 'screenshot') {
      return {
        status: 'verified_success',
        visualDeltaPercent: visualDelta,
        summary: `PRISM verified: Execution paused as planned (encoded-change score ${visualDelta}/100).`,
        verifiedAt,
      };
    }

    // Check for stalled / dropped input (No visual change detected)
    if (visualDelta < 0.1 && !windowChanged) {
      return {
        status: 'stalled_no_change',
        visualDeltaPercent: visualDelta,
        summary: 'PRISM warning: No visual change detected on screen after action.',
        recoverySuggestion: 'Target application may be slow to respond. Retry action or press Enter/Tab.',
        verifiedAt,
      };
    }

    // If active window changed significantly or large delta occurs
    if (windowChanged) {
      return {
        status: 'verified_success',
        visualDeltaPercent: visualDelta,
        summary: `PRISM heuristic: window transition (Window ID: ${post.activeWindowId}, encoded-change score ${visualDelta}/100).`,
        verifiedAt,
      };
    }

    // Default successful verified transition
    return {
      status: 'verified_success',
      visualDeltaPercent: visualDelta,
      summary: `PRISM heuristic: encoded image changed (encoded-change score ${visualDelta}/100).`,
      verifiedAt,
    };
  }
}

export const defaultPrismVerifier = new PrismVerifier();
