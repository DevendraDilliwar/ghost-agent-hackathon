import type { SourceDecision } from '../../agent/ports';

const FAILURE = 'Meta returned an unsupported source response. No desktop action was taken.';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(FAILURE);
  return value as Record<string, unknown>;
}

export function parseSourceResponse(value: unknown): SourceDecision {
  const response = record(value);
  if (response.status === 'incomplete') throw new Error('Meta stopped while reading the source image. No desktop action was taken. Try a clearer photo.');
  if (response.status === 'failed') throw new Error('Meta could not read the source image. No desktop action was taken. Try again later.');
  if (response.status !== 'completed') throw new Error(FAILURE);
  const usage = record(response.usage);
  if (typeof usage.input_tokens !== 'number' || !Number.isInteger(usage.input_tokens) || usage.input_tokens < 0) throw new Error(FAILURE);
  if (typeof usage.output_tokens !== 'number' || !Number.isInteger(usage.output_tokens) || usage.output_tokens < 0) throw new Error(FAILURE);
  if (!Array.isArray(response.output)) throw new Error(FAILURE);
  const chunks: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const data = item as Record<string, unknown>;
    if (data.type !== 'message' || !Array.isArray(data.content)) continue;
    for (const part of data.content) {
      if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
      const content = part as Record<string, unknown>;
      if (content.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text);
    }
  }
  if (!chunks.length) throw new Error(FAILURE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(chunks.join(''));
  } catch {
    throw new Error(FAILURE);
  }
  const result = record(parsed);
  const keys = Object.keys(result);
  if (!keys.length || !keys.every(key => key === 'text' || key === 'lowConfidence')) throw new Error(FAILURE);
  if (typeof result.text !== 'string' || result.text.length > 16_000) throw new Error(FAILURE);
  if (typeof result.lowConfidence !== 'boolean') throw new Error(FAILURE);
  return { text: result.text, lowConfidence: result.lowConfidence, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}
