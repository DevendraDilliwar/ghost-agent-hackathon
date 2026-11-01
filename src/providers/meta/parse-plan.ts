import { isDomainId } from '../../shared/contracts/mission';
import type { PlanDecision } from '../../agent/ports';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Meta returned an invalid plan response.');
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Meta did not return valid token usage.');
  return value;
}

export function parsePlanResponse(value: unknown): PlanDecision {
  const response = record(value);
  if (response.status === 'incomplete') {
    const details = response.incomplete_details;
    const reason = details && typeof details === 'object' && 'reason' in details ? details.reason : null;
    if (reason === 'max_output_tokens') {
      const usage = response.usage;
      const count = usage && typeof usage === 'object' && 'output_tokens' in usage ? usage.output_tokens : null;
      const usageText = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? ' (' + count + ' output tokens used)' : '';
      throw new Error('Meta reached the response token limit while planning your goal' + usageText + '. No desktop action was taken. Try a shorter goal; if this repeats, the plan response budget needs adjustment.');
    }
    if (reason === 'content_filter') throw new Error('Meta stopped planning because of a content filter. No desktop action was taken. Review the goal text.');
    throw new Error('Meta stopped while planning your goal. No desktop action was taken. Try a shorter goal.');
  }
  if (response.status === 'failed') throw new Error('Meta could not plan this goal. No desktop action was taken. Try again later.');
  if (response.status !== 'completed') throw new Error('Meta returned an unsupported plan response. No desktop action was taken.');
  if (!Array.isArray(response.output)) throw new Error('Meta returned an invalid plan response. No desktop action was taken.');
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
  try { parsed = JSON.parse(chunks.join('').slice(0, 6000)) as unknown; }
  catch { throw new Error('Meta did not return the plan as JSON. No desktop action was taken. Try again.'); }
  const plan = record(parsed);
  for (const key of Object.keys(plan)) {
    if (!['phases'].includes(key)) throw new Error('Meta returned an unsupported plan field. No desktop action was taken.');
  }
  if (!Array.isArray(plan.phases) || plan.phases.length < 1 || plan.phases.length > 8) {
    throw new Error('Meta returned an invalid phase list. No desktop action was taken.');
  }
  const phases = plan.phases.map(entry => {
    const phase = record(entry);
    for (const key of Object.keys(phase)) {
      if (!['domain', 'goal', 'steps', 'success'].includes(key)) throw new Error('Meta returned an unsupported phase field. No desktop action was taken.');
    }
    if (!isDomainId(phase.domain)) throw new Error('Meta returned an invalid phase domain. No desktop action was taken.');
    const goal = phase.goal;
    if (typeof goal !== 'string' || !goal.trim() || goal.length > 500) {
      throw new Error('Meta returned an invalid phase goal. No desktop action was taken.');
    }
    let steps: string[] = [];
    if (phase.steps !== undefined) {
      if (!Array.isArray(phase.steps) || phase.steps.length < 1 || phase.steps.length > 12) {
        throw new Error('Meta returned an invalid phase step list. No desktop action was taken.');
      }
      steps = phase.steps.map(step => {
        if (typeof step !== 'string' || !step.trim() || step.length > 200) {
          throw new Error('Meta returned an invalid phase step. No desktop action was taken.');
        }
        return step.trim();
      });
    }
    const success = phase.success;
    if (typeof success !== 'string' || !success.trim() || success.length > 500) {
      throw new Error('Meta returned an invalid phase success condition. No desktop action was taken.');
    }
    return { domain: phase.domain, goal: goal.trim(), steps, success: success.trim() };
  });
  return { phases, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
}
