import type { FillPlanDecision } from '../../agent/ports';

const FAILURE = '. No desktop action was taken.';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Meta returned an invalid fill-plan response' + FAILURE);
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Meta did not return valid token usage.');
  return value;
}

export function parseFillPlanResponse(value: unknown): FillPlanDecision {
  const response = record(value);
  if (response.status === 'incomplete') throw new Error('Meta stopped while listing the rows to fill' + FAILURE + ' Try a shorter goal.');
  if (response.status === 'failed') throw new Error('Meta could not list the rows to fill' + FAILURE + ' Try again later.');
  if (response.status !== 'completed') throw new Error('Meta returned an unsupported fill-plan response' + FAILURE);
  if (!Array.isArray(response.output)) throw new Error('Meta returned an invalid fill-plan response' + FAILURE);
  const usage = record(response.usage);
  const chunks: string[] = [];
  for (const entry of response.output) {
    const item = record(entry);
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      const content = record(part);
      if (content.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text);
    }
  }
  let parsed: unknown;
  try { parsed = JSON.parse(chunks.join('').slice(0, 32_000)) as unknown; }
  catch { throw new Error('Meta did not return the fill plan as JSON' + FAILURE + ' Try again.'); }
  const plan = record(parsed);
  for (const key of Object.keys(plan)) {
    if (!['units', 'chunkRows', 'startHint'].includes(key)) throw new Error('Meta returned an unsupported fill-plan field' + FAILURE);
  }
  if (!Array.isArray(plan.units) || plan.units.length > 200) {
    throw new Error('Meta returned an invalid fill-unit list' + FAILURE);
  }
  const units = plan.units.map(entry => {
    const unit = record(entry);
    for (const key of Object.keys(unit)) {
      if (key !== 'cells') throw new Error('Meta returned an unsupported fill-unit field' + FAILURE);
    }
    if (!Array.isArray(unit.cells) || unit.cells.length < 1 || unit.cells.length > 10) {
      throw new Error('Meta returned an invalid fill-unit cell list' + FAILURE);
    }
    const cells = unit.cells.map(cell => {
      if (typeof cell !== 'string' || cell.length > 200) throw new Error('Meta returned an invalid fill-unit cell' + FAILURE);
      return cell.trim();
    });
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    return { cells };
  }).filter(unit => unit.cells.length > 0);
  const chunkRaw = plan.chunkRows;
  const chunkRows = typeof chunkRaw === 'number' && Number.isSafeInteger(chunkRaw)
    ? Math.min(10, Math.max(1, chunkRaw)) : 5;
  const hintRaw = plan.startHint;
  const startHint = typeof hintRaw === 'string' ? hintRaw.trim().slice(0, 200) : '';
  return { units, chunkRows, startHint, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
}
