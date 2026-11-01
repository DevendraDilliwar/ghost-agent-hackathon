import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDomainId } from '../shared/contracts/mission';
import type { DomainId, MissionMeta, MissionSummary, PhaseCheckpoint, PhaseStatus } from '../shared/contracts/mission';
import type { ParsedIntent } from '../shared/contracts/task';

/**
 * Durable per-phase checkpoints. One JSON file per phase under
 * <baseDir>/<missionId>/checkpoints/<phaseId>.json, plus mission.json.
 * Writes are atomic (tmp file + rename); every method is total — load
 * failures, corrupt files and invalid ids yield null/[] instead of throwing,
 * so a damaged checkpoint can never crash the agent loop.
 */
export class CheckpointStore {
  constructor(private readonly baseDir: string) {}

  async saveMission(meta: MissionMeta): Promise<void> {
    try {
      if (!idPattern.test(meta.missionId) || !meta.goal.trim() || meta.goal.length > 2000) return;
      await this.writeJson(this.missionDir(meta.missionId), 'mission.json', meta);
    } catch {
      // Checkpoints are best-effort; the live run continues without them.
    }
  }

  async loadMission(missionId: string): Promise<MissionMeta | null> {
    try {
      if (!idPattern.test(missionId)) return null;
      const parsed: unknown = JSON.parse(await this.readBounded(join(this.missionDir(missionId), 'mission.json')));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const meta = parsed as Record<string, unknown>;
      if (meta.missionId !== missionId || typeof meta.goal !== 'string' || !meta.goal.trim() || meta.goal.length > 2000) return null;
      if (typeof meta.createdAt !== 'number' || !Number.isSafeInteger(meta.createdAt)) return null;
      return { missionId, goal: meta.goal, createdAt: meta.createdAt };
    } catch {
      return null;
    }
  }

  async save(checkpoint: PhaseCheckpoint): Promise<void> {
    try {
      if (!idPattern.test(checkpoint.missionId) || !phasePattern.test(checkpoint.phaseId)) return;
      await this.writeJson(join(this.missionDir(checkpoint.missionId), 'checkpoints'), checkpoint.phaseId + '.json', checkpoint);
    } catch {
      // Checkpoints are best-effort; the live run continues without them.
    }
  }

  async load(missionId: string, phaseId: string): Promise<PhaseCheckpoint | null> {
    try {
      if (!idPattern.test(missionId) || !phasePattern.test(phaseId)) return null;
      const parsed: unknown = JSON.parse(await this.readBounded(join(this.missionDir(missionId), 'checkpoints', phaseId + '.json')));
      return validCheckpoint(parsed, missionId, phaseId);
    } catch {
      return null;
    }
  }

  /** All valid checkpoints for a mission in plan order; skips corrupt files. */
  async list(missionId: string): Promise<PhaseCheckpoint[]> {
    try {
      if (!idPattern.test(missionId)) return [];
      const directory = join(this.missionDir(missionId), 'checkpoints');
      const files = await readdir(directory).catch(() => []);
      const found: PhaseCheckpoint[] = [];
      for (const file of files) {
        const phaseId = /^phase-[0-9]{1,3}\.json$/.exec(file)?.[0].slice(0, -5);
        if (!phaseId) continue;
        const checkpoint = await this.load(missionId, phaseId);
        if (checkpoint) found.push(checkpoint);
      }
      return found.sort((a, b) => a.order - b.order);
    } catch {
      return [];
    }
  }

  /** Newest-first mission summaries for the resume UI. Skips invalid entries. */
  async listMissions(): Promise<MissionSummary[]> {
    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true }).catch(() => []);
      const summaries: MissionSummary[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
        const meta = await this.loadMission(entry.name);
        if (!meta) continue;
        const checkpoints = await this.list(entry.name);
        summaries.push({
          missionId: meta.missionId, goal: meta.goal, createdAt: meta.createdAt,
          updatedAt: checkpoints.reduce((max, item) => Math.max(max, item.savedAt), meta.createdAt),
          phases: checkpoints.map(item => ({ phaseId: item.phaseId, domain: item.domain, goal: item.goal, status: item.status })),
        });
        if (summaries.length >= 50) break;
      }
      return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  private missionDir(missionId: string): string {
    return join(this.baseDir, missionId);
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
    if (data.length > 262_144) throw new Error('Checkpoint too large.');
    return data;
  }
}

const idPattern = /^[A-Za-z0-9-]{1,80}$/;
const phasePattern = /^phase-[0-9]{1,3}$/;
const statuses: PhaseStatus[] = ['pending', 'active', 'done', 'failed'];

function stringList(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  for (const item of value) {
    if (typeof item !== 'string' || !item || item.length > maxLength) return null;
  }
  return [...value];
}

function validIntent(value: unknown): ParsedIntent | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const intent = value as Record<string, unknown>;
  if (typeof intent.summary !== 'string' || !intent.summary.trim() || intent.summary.length > 500) return undefined;
  if (!intent.params || typeof intent.params !== 'object' || Array.isArray(intent.params)) return undefined;
  const params: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(intent.params)) {
    if (!key.trim() || key.length > 64 || typeof candidate !== 'string' || !candidate.trim() || candidate.length > 200) return undefined;
    params[key] = candidate;
  }
  if (Object.keys(params).length > 20) return undefined;
  if (!Array.isArray(intent.missing) || intent.missing.length > 20) return undefined;
  for (const item of intent.missing) {
    if (typeof item !== 'string' || !item.trim() || item.length > 200) return undefined;
  }
  return { summary: intent.summary, params, missing: [...intent.missing] };
}

function validCheckpoint(value: unknown, missionId: string, phaseId: string): PhaseCheckpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.missionId !== missionId || data.phaseId !== phaseId) return null;
  if (typeof data.order !== 'number' || !Number.isSafeInteger(data.order) || data.order < 0 || data.order > 20) return null;
  if (!isDomainId(data.domain) || !statuses.includes(data.status as PhaseStatus)) return null;
  if (typeof data.goal !== 'string' || !data.goal.trim() || data.goal.length > 500) return null;
  const notes = stringList(data.notes, 50, 600);
  const clarifications = stringList(data.clarifications, 5, 1000);
  const executedDescs = stringList(data.executedDescs, 60, 2000);
  const steps = stringList(data.steps, 12, 200);
  if (!notes || !clarifications || !executedDescs || !steps) return null;
  if (typeof data.success !== 'string' || data.success.length > 500) return null;
  const intent = validIntent(data.intent);
  if (intent === undefined) return null;
  if (data.lastVerification !== null && (typeof data.lastVerification !== 'string' || !data.lastVerification || data.lastVerification.length > 2000)) return null;
  for (const key of ['inputTokens', 'outputTokens', 'noProgressStreak', 'savedAt'] as const) {
    if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 0) return null;
  }
  // Stall-cycle counter: absent in checkpoints written before the cap, so default to 0.
  if (data.stallCycles !== undefined &&
    (typeof data.stallCycles !== 'number' || !Number.isSafeInteger(data.stallCycles) || data.stallCycles < 0)) return null;
  const stallCycles = data.stallCycles === undefined ? 0 : (data.stallCycles as number);
  // Step progress: absent in checkpoints written before step tracking, so default to fresh.
  const completedSteps = data.completedSteps === undefined ? [] : data.completedSteps;
  if (!Array.isArray(completedSteps) || completedSteps.length > 12 ||
    completedSteps.some(index => typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= steps.length)) return null;
  const activeStep = data.activeStep === undefined ? null : data.activeStep;
  if (activeStep !== null && (typeof activeStep !== 'number' || !Number.isSafeInteger(activeStep) || activeStep < 0 || activeStep >= steps.length)) return null;
  return {
    missionId, phaseId, order: data.order, domain: data.domain as DomainId, status: data.status as PhaseStatus,
    goal: data.goal, notes, steps, success: data.success, intent, clarifications, executedDescs,
    lastVerification: data.lastVerification as string | null,
    inputTokens: data.inputTokens as number, outputTokens: data.outputTokens as number,
    noProgressStreak: data.noProgressStreak as number, stallCycles,
    completedSteps: [...completedSteps] as number[], activeStep: activeStep as number | null,
    savedAt: data.savedAt as number,
  };
}
