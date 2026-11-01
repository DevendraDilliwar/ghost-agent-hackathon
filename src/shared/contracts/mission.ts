/**
 * Mission contract — domain-separated multi-phase plans plus their persisted
 * checkpoint form. Pure types: safe for every layer including the renderer.
 */

/**
 * Free-form short label for the system a phase runs in. The planner chooses it
 * per mission ("github", "aws", "sap", "tally", ...): those are examples, never
 * a closed list. The agent must be able to plan for systems we never imagined.
 */
export type DomainId = string;

const domainPattern = /^[a-z0-9][a-z0-9-_]{0,31}$/i;

export function isDomainId(value: unknown): value is DomainId {
  return typeof value === 'string' && domainPattern.test(value);
}

export type PhaseStatus = 'pending' | 'active' | 'done' | 'failed';

export interface PhaseRecord {
  readonly phaseId: string;
  readonly domain: DomainId;
  readonly goal: string;
  readonly status: PhaseStatus;
  /** Domain-scoped facts only (project ids, urls, decisions). Redacted. */
  readonly notes: string[];
  /** Planner's step checklist for this phase (guidance, not a progress counter). */
  readonly steps: string[];
  /** Visible done-condition, verified from the screen before the phase closes. */
  readonly success: string;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}

export interface MissionPlan {
  readonly missionId: string;
  readonly goal: string;
  readonly phases: PhaseRecord[];
  readonly createdAt: number;
}

/** The only context the planner sees for one phase: that phase, nothing else. */
export interface PhaseContext {
  readonly phaseId: string;
  readonly domain: DomainId;
  readonly goal: string;
  readonly status: PhaseStatus;
  readonly notes: string[];
  readonly steps: string[];
  readonly success: string;
}

/** Durable per-phase snapshot. Redacted: descriptions and summaries only. */
export interface PhaseCheckpoint {
  readonly missionId: string;
  readonly phaseId: string;
  /** Position in the plan; list() returns checkpoints in plan order. */
  readonly order: number;
  readonly domain: DomainId;
  readonly goal: string;
  readonly status: PhaseStatus;
  readonly notes: string[];
  readonly steps: string[];
  readonly success: string;
  readonly intent: import('./task').ParsedIntent | null;
  readonly clarifications: string[];
  /** Executed-step descriptions used to rebuild decide() history on resume. */
  readonly executedDescs: string[];
  readonly lastVerification: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly noProgressStreak: number;
  /** Consecutive stall handoffs without progress. Absent in checkpoints written before the stall cap. */
  readonly stallCycles?: number;
  readonly savedAt: number;
}

export interface MissionMeta {
  readonly missionId: string;
  readonly goal: string;
  readonly createdAt: number;
}

/** Lightweight mission listing for the resume UI. Redacted like checkpoints. */
export interface MissionPhaseSummary {
  readonly phaseId: string;
  readonly domain: DomainId;
  readonly goal: string;
  readonly status: PhaseStatus;
}

export interface MissionSummary {
  readonly missionId: string;
  readonly goal: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly phases: MissionPhaseSummary[];
}
