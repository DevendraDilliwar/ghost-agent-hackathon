import type { ExtractDecision } from '../../agent/ports';

const FAILURE = 'Meta returned an unsupported extract response. No desktop action was taken.';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(FAILURE);
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

export function parseExtractResponse(value: unknown): ExtractDecision {
  const response = record(value);
  if (response.status === 'incomplete') throw new Error('Meta stopped while extracting bill fields. No desktop action was taken. Try a clearer photo.');
  if (response.status === 'failed') throw new Error('Meta could not extract bill fields. No desktop action was taken. Try again later.');
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
  if (!keys.length || !keys.every(key => key === 'billNo' || key === 'date' || key === 'total' || key === 'items' || key === 'missing')) throw new Error(FAILURE);
  const billNo = boundedText(result.billNo, 200);
  const date = boundedText(result.date, 200);
  const total = boundedText(result.total, 200);
  if (billNo === null || date === null || total === null) throw new Error(FAILURE);
  if (!Array.isArray(result.items) || result.items.length > 50) throw new Error(FAILURE);
  const items: Array<{ name: string; qty: string; price: string }> = [];
  for (const row of result.items) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(FAILURE);
    const cells = row as Record<string, unknown>;
    const cellKeys = Object.keys(cells);
    if (!cellKeys.length || !cellKeys.every(key => key === 'name' || key === 'qty' || key === 'price')) throw new Error(FAILURE);
    const name = boundedText(cells.name, 200);
    const qty = boundedText(cells.qty, 200);
    const price = boundedText(cells.price, 200);
    if (name === null || qty === null || price === null) throw new Error(FAILURE);
    items.push({ name, qty, price });
  }
  if (!Array.isArray(result.missing) || result.missing.length > 10) throw new Error(FAILURE);
  const missing: string[] = [];
  for (const gap of result.missing) {
    const text = boundedText(gap, 200);
    if (text === null) throw new Error(FAILURE);
    missing.push(text);
  }
  return { billNo, date, total, items, missing, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}
