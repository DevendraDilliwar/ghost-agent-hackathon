import type { VerifyDecision } from '../../agent/ports';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Meta returned an invalid verification response.');
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Meta did not return valid token usage.');
  return value;
}

export function parseVerifyResponse(value: unknown): VerifyDecision {
  const response = record(value);
  if (response.status === 'incomplete') throw new Error('Meta stopped while verifying the screen. No further action was taken.');
  if (response.status === 'failed') throw new Error('Meta could not verify the screen. No further action was taken. Try again later.');
  if (response.status !== 'completed') throw new Error('Meta returned an unsupported verification response. No further action was taken.');
  if (!Array.isArray(response.output)) throw new Error('Meta returned an invalid verification response. No further action was taken.');
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
  catch { throw new Error('Meta did not return verification as JSON. No further action was taken. Try again.'); }
  const verdict = record(parsed);
  for (const key of Object.keys(verdict)) {
    if (!['confirmed', 'detail'].includes(key)) throw new Error('Meta returned an unsupported verification field. No further action was taken.');
  }
  if (typeof verdict.confirmed !== 'boolean') throw new Error('Meta returned an invalid verification result. No further action was taken.');
  const detail = verdict.detail;
  if (typeof detail !== 'string' || !detail.trim() || detail.length > 500 || detail.includes('\0')) {
    throw new Error('Meta returned an invalid verification detail.');
  }
  return { confirmed: verdict.confirmed, detail, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
}
