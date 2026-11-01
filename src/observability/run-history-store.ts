import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDomainId } from '../shared/contracts/mission';
import type { MissionPlan, PhaseRecord, PhaseStatus } from '../shared/contracts/mission';
import type { RunRecord, RunSummary } from '../shared/contracts/history';
import type {
  ActionType, ActionVerification, AgentAction, AgentStatus, ChatMessage, TaskSnapshot,
} from '../shared/contracts/task';

/**
 * Durable local record of every run (chat thread). One JSON file per run
 * under <baseDir>/<runId>.json. Same rules as the checkpoint store: atomic
 * writes, bounded reads, total methods that never throw, redacted content
 * (no screenshots, no typed text, no coordinates, no evidence images).
 */
export class RunHistoryStore {
  constructor(private readonly baseDir: string) {}

  async saveRun(record: Omit<RunRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      if (!idPattern.test(record.runId)) return;
      const now = Date.now();
      const previous = await this.loadRun(record.runId);
      await this.writeJson(this.baseDir, record.runId + '.json', {
        ...record, createdAt: previous?.createdAt ?? now, updatedAt: now,
      });
    } catch {
      // History is best-effort; the live run continues without it.
    }
  }

  async loadRun(runId: string): Promise<RunRecord | null> {
    try {
      if (!idPattern.test(runId)) return null;
      const parsed: unknown = JSON.parse(await this.readBounded(join(this.baseDir, runId + '.json')));
      return validRecord(parsed, runId);
    } catch {
      return null;
    }
  }

  /** Newest-first run summaries for the history UI. Skips invalid entries. */
  async listRuns(): Promise<RunSummary[]> {
    try {
      const files = await readdir(this.baseDir).catch(() => []);
      const summaries: RunSummary[] = [];
      for (const file of files) {
        const runId = /^([A-Za-z0-9-]{1,80})\.json$/.exec(file)?.[1];
        if (!runId) continue;
        const record = await this.loadRun(runId);
        if (!record) continue;
        summaries.push({
          runId: record.runId, goal: record.goal, status: record.status,
          createdAt: record.createdAt, updatedAt: record.updatedAt,
          missionId: record.missionId, resumable: record.resumable,
        });
        if (summaries.length >= 200) break;
      }
      return summaries.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
    } catch {
      return [];
    }
  }

  private async writeJson(directory: string, file: string, value: unknown): Promise<void> {
    await mkdir(directory, { recursive: true });
    const target = join(directory, file);
    const tmp = target + '.tmp';
    await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await rename(tmp, target);
  }

  private async readBounded(file: string): Promise<string> {
    const data = await readFile(file, 'utf8');
    if (data.length > 262_144) throw new Error('Run record too large.');
    return data;
  }
}

const idPattern = /^[A-Za-z0-9-]{1,80}$/;
const statuses: AgentStatus[] = ['idle', 'preparing', 'observing', 'thinking', 'validating',
  'awaiting_approval', 'acting', 'verifying', 'completed', 'paused', 'needs_user', 'stopped', 'failed'];
const senders = ['user', 'agent', 'system'];
const actionTypes: ActionType[] = ['click', 'double_click', 'type', 'key_press', 'scroll', 'wait', 'verify'];
const actionStatuses: AgentAction['status'][] = ['pending', 'awaiting_approval', 'executed', 'rejected', 'failed'];
const riskLevels: NonNullable<AgentAction['riskLevel']>[] = ['safe', 'medium', 'high'];
const verificationStatuses: ActionVerification['status'][] = ['verified_success', 'stalled_no_change', 'error_dialog_detected', 'human_intervention_needed'];
const phaseStatuses: PhaseStatus[] = ['pending', 'active', 'done', 'failed'];

function text(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  for (const item of value) {
    if (typeof item !== 'string' || item.length > maxLength) return null;
  }
  return [...value];
}

function validVerification(value: unknown): ActionVerification | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  if (!verificationStatuses.includes(data.status as ActionVerification['status'])) return undefined;
  if (typeof data.visualDeltaPercent !== 'number' || !Number.isFinite(data.visualDeltaPercent)) return undefined;
  const summary = text(data.summary, 2000);
  if (summary === null) return undefined;
  const recoverySuggestion = data.recoverySuggestion === undefined ? undefined : text(data.recoverySuggestion, 2000);
  if (recoverySuggestion === null) return undefined;
  if (typeof data.verifiedAt !== 'number' || !Number.isSafeInteger(data.verifiedAt) || data.verifiedAt < 0) return undefined;
  return {
    status: data.status as ActionVerification['status'], visualDeltaPercent: data.visualDeltaPercent, summary,
    ...(recoverySuggestion === undefined ? {} : { recoverySuggestion }), verifiedAt: data.verifiedAt,
  };
}

function validAction(value: unknown): AgentAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = text(data.id, 80);
  const description = text(data.description, 2000);
  const timestamp = text(data.timestamp, 64);
  if (!id || description === null || timestamp === null) return null;
  if (!actionTypes.includes(data.type as ActionType)) return null;
  if (!actionStatuses.includes(data.status as AgentAction['status'])) return null;
  const target = data.target === undefined ? undefined : text(data.target, 500);
  if (target === null) return null;
  const riskLevel = data.riskLevel === undefined ? undefined : riskLevels.includes(data.riskLevel as NonNullable<AgentAction['riskLevel']>)
    ? data.riskLevel as NonNullable<AgentAction['riskLevel']> : null;
  if (riskLevel === null) return null;
  const verification = validVerification(data.verification);
  if (data.verification !== undefined && verification === undefined) return null;
  return {
    id, type: data.type as ActionType, description, timestamp, status: data.status as AgentAction['status'],
    ...(target === undefined ? {} : { target }),
    ...(riskLevel === undefined ? {} : { riskLevel }),
    ...(verification === undefined ? {} : { verification }),
  };
}

function validMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = text(data.id, 80);
  const content = text(data.content, 4000);
  const timestamp = text(data.timestamp, 64);
  if (!id || content === null || timestamp === null) return null;
  if (!senders.includes(data.sender as string)) return null;
  return { id, sender: data.sender as ChatMessage['sender'], content, timestamp };
}

function validMission(value: unknown): MissionPlan | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.missionId !== 'string' || !idPattern.test(data.missionId)) return undefined;
  const goal = text(data.goal, 2000);
  if (goal === null) return undefined;
  if (typeof data.createdAt !== 'number' || !Number.isSafeInteger(data.createdAt) || data.createdAt < 0) return undefined;
  if (!Array.isArray(data.phases) || data.phases.length > 20) return undefined;
  const phases: PhaseRecord[] = [];
  for (const item of data.phases) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    const phase = item as Record<string, unknown>;
    if (typeof phase.phaseId !== 'string' || !idPattern.test(phase.phaseId)) return undefined;
    if (!isDomainId(phase.domain)) return undefined;
    const phaseGoal = text(phase.goal, 500);
    if (!phaseGoal) return undefined;
    if (!phaseStatuses.includes(phase.status as PhaseStatus)) return undefined;
    const notes = stringList(phase.notes, 50, 600);
    const steps = stringList(phase.steps, 12, 200);
    const success = text(phase.success, 500);
    if (!notes || !steps || success === null) return undefined;
    for (const key of ['startedAt', 'finishedAt'] as const) {
      if (phase[key] !== null && (typeof phase[key] !== 'number' || !Number.isSafeInteger(phase[key]) || (phase[key] as number) < 0)) return undefined;
    }
    const completedSteps = Array.isArray(phase.completedSteps) && phase.completedSteps.length <= 12 &&
      (phase.completedSteps as unknown[]).every(index => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index < steps.length)
      ? [...phase.completedSteps] as number[]
      : [];
    const activeStep = typeof phase.activeStep === 'number' && Number.isSafeInteger(phase.activeStep) &&
      phase.activeStep >= 0 && phase.activeStep < steps.length ? phase.activeStep : null;
    phases.push({
      phaseId: phase.phaseId, domain: phase.domain, goal: phaseGoal, status: phase.status as PhaseStatus,
      notes, steps, success, startedAt: phase.startedAt as number | null, finishedAt: phase.finishedAt as number | null,
      completedSteps, activeStep,
    });
  }
  return { missionId: data.missionId, goal, phases, createdAt: data.createdAt };
}

function validRecord(value: unknown, runId: string): RunRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.runId !== runId) return null;
  const goal = text(data.goal, 2000);
  const message = text(data.message, 2000);
  if (goal === null || message === null) return null;
  if (!statuses.includes(data.status as AgentStatus)) return null;
  for (const key of ['createdAt', 'updatedAt', 'inputTokens', 'outputTokens'] as const) {
    if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 0) return null;
  }
  for (const key of ['maxSteps', 'maxMinutes'] as const) {
    if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 1 || (data[key] as number) > 1000) return null;
  }
  if (data.missionId !== null && (typeof data.missionId !== 'string' || !idPattern.test(data.missionId))) return null;
  if (typeof data.resumable !== 'boolean') return null;
  if (!Array.isArray(data.messages) || data.messages.length > 200) return null;
  const messages: ChatMessage[] = [];
  for (const item of data.messages) {
    const message = validMessage(item);
    if (!message) return null;
    messages.push(message);
  }
  if (!Array.isArray(data.actions) || data.actions.length > 120) return null;
  const actions: AgentAction[] = [];
  for (const item of data.actions) {
    const action = validAction(item);
    if (!action) return null;
    actions.push(action);
  }
  const mission = validMission(data.mission);
  if (mission === undefined) return null;
  return {
    runId, goal, status: data.status as AgentStatus, message, messages, actions, mission,
    missionId: data.missionId as string | null, resumable: data.resumable,
    maxSteps: data.maxSteps as number, maxMinutes: data.maxMinutes as number,
    inputTokens: data.inputTokens as number, outputTokens: data.outputTokens as number,
    createdAt: data.createdAt as number, updatedAt: data.updatedAt as number,
  };
}

/** Convert a live snapshot into a redacted, bounded history record. Returns null when the run id is unsafe. */
export function toRunRecord(snapshot: TaskSnapshot): Omit<RunRecord, 'createdAt' | 'updatedAt'> | null {
  if (!snapshot.runId || !idPattern.test(snapshot.runId)) return null;
  const mission = snapshot.mission;
  return {
    runId: snapshot.runId,
    goal: snapshot.goal.slice(0, 2000),
    status: snapshot.status,
    missionId: mission?.missionId ?? null,
    resumable: mission ? mission.phases.some(phase => phase.status === 'failed' || phase.status === 'active') : false,
    maxSteps: snapshot.maxSteps,
    maxMinutes: snapshot.maxMinutes,
    message: snapshot.message.slice(0, 2000),
    messages: snapshot.messages.slice(-200).map(item => ({
      id: item.id.slice(0, 80), sender: item.sender, content: item.content.slice(0, 4000), timestamp: item.timestamp.slice(0, 64),
    })),
    actions: snapshot.actions.slice(-120).map(item => ({
      id: item.id.slice(0, 80), type: item.type, description: item.description.slice(0, 2000),
      timestamp: item.timestamp.slice(0, 64), status: item.status,
      ...(item.target === undefined ? {} : { target: item.target.slice(0, 500) }),
      ...(item.riskLevel === undefined ? {} : { riskLevel: item.riskLevel }),
      ...(item.verification === undefined ? {} : {
        verification: {
          ...item.verification,
          summary: item.verification.summary.slice(0, 2000),
          ...(item.verification.recoverySuggestion === undefined ? {}
            : { recoverySuggestion: item.verification.recoverySuggestion.slice(0, 2000) }),
        },
      }),
    })),
    inputTokens: snapshot.inputTokens,
    outputTokens: snapshot.outputTokens,
    mission: mission ? {
      missionId: mission.missionId, goal: mission.goal.slice(0, 2000), createdAt: mission.createdAt,
      phases: mission.phases.slice(0, 20).map(phase => ({
        phaseId: phase.phaseId, domain: phase.domain, goal: phase.goal.slice(0, 500), status: phase.status,
        notes: phase.notes.slice(0, 50).map(note => note.slice(0, 600)),
        steps: phase.steps.slice(0, 12).map(step => step.slice(0, 200)),
        success: phase.success.slice(0, 500), startedAt: phase.startedAt, finishedAt: phase.finishedAt,
        completedSteps: phase.completedSteps.filter(index => index < phase.steps.length).slice(0, 12),
        activeStep: phase.activeStep !== null && phase.activeStep < phase.steps.length ? phase.activeStep : null,
      })),
    } : null,
  };
}
