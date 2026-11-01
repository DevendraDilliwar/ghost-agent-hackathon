import type { DesktopCommand } from '../../shared/contracts/desktop';
import type { PhaseContext } from '../../shared/contracts/mission';

/**
 * Self-fix error loop (P3) — what a human does when a step fails, automated.
 *
 * First consecutive failure: retry with targeted recovery guidance injected
 * into the next decide() history (focus hints per action type). Second
 * consecutive failure: stop guessing and escalate to the user with the full
 * story (phase, attempts, observations, what was already tried). Rule-based
 * and deterministic: recovery costs zero extra model calls.
 */
export interface FailureContext {
  readonly action: DesktopCommand;
  readonly verificationSummary: string;
  /** verifyText detail for failed type actions; null otherwise. */
  readonly typeDetail: string | null;
  /** Consecutive failures BEFORE this one (0 = first failure). */
  readonly streak: number;
  readonly phase: PhaseContext | null;
  /** Recent 'status: description' entries, oldest first. */
  readonly recentAttempts: string[];
  /** Guidance already given on the previous attempt, if any. */
  readonly priorGuidance: string | null;
}

export type RecoveryDecision =
  | { kind: 'retry'; guidance: string }
  | { kind: 'escalate'; reason: string };

export interface EscalationStory {
  readonly phase: PhaseContext | null;
  readonly recentAttempts: string[];
  readonly verificationSummary: string;
  readonly priorGuidance: string | null;
}

const genericStall = 'The last action caused no visible change. Do not repeat it unchanged - back out or try a different target.';

function guidanceFor(context: FailureContext): string {
  if (context.action.type === 'type' && context.typeDetail) {
    return 'The last type failed (' + context.typeDetail.slice(0, 200) + '). Do not repeat it unchanged - back out (Escape), re-check focus, then type again.';
  }
  switch (context.action.type) {
    case 'keypress':
      return 'The shortcut had no visible effect. Click the target field first to focus it, then press the keys again - do not repeat the shortcut unfocused.';
    case 'scroll':
      return 'Scrolling had no visible effect. Click inside the area to scroll first to focus it, then scroll again - do not repeat the scroll unfocused.';
    default:
      return genericStall;
  }
}

function dotted(text: string): string {
  return text.endsWith('.') ? text : text + '.';
}

function storyFor(context: EscalationStory): string {
  const where = context.phase ? ' on [' + context.phase.domain + '] phase "' + context.phase.goal + '"' : '';
  const attempts = context.recentAttempts.slice(-2).map(entry => entry.slice(0, 150)).join(' | ') || 'the last action';
  const tried = context.priorGuidance ? ' Already tried: ' + dotted(context.priorGuidance.slice(0, 200)) : '';
  return ('Stuck' + where + '. Attempts: ' + attempts + '. Observed: ' + dotted(context.verificationSummary.slice(0, 200)) + tried +
    ' Take control of the desktop, fix the screen, then resume - or stop the run.').slice(0, 1000);
}

export class ErrorLoop {
  decide(context: FailureContext): RecoveryDecision {
    if (context.streak < 1) return { kind: 'retry', guidance: guidanceFor(context) };
    return { kind: 'escalate', reason: this.story(context) };
  }

  story(context: EscalationStory): string {
    return storyFor(context);
  }
}

export const defaultErrorLoop = new ErrorLoop();
