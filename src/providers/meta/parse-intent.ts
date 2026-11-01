import type { ClarificationQuestion, ParsedIntent } from '../../shared/contracts/task';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Meta returned an invalid intent response.');
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Meta did not return valid token usage.');
  return value;
}

function boundedText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new Error('Meta returned an invalid intent ' + label + '.');
  }
  return value;
}

export function parseIntentResponse(value: unknown): { intent: ParsedIntent; inputTokens: number; outputTokens: number } {
  const response = record(value);
  if (response.status === 'incomplete') throw new Error('Meta stopped while understanding your goal. No desktop action was taken. Try a shorter goal.');
  if (response.status === 'failed') throw new Error('Meta could not understand this goal. No desktop action was taken. Try again later.');
  if (response.status !== 'completed') throw new Error('Meta returned an unsupported intent response. No desktop action was taken.');
  if (!Array.isArray(response.output)) throw new Error('Meta returned an invalid intent response. No desktop action was taken.');
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
  catch { throw new Error('Meta did not return intent as JSON. No desktop action was taken. Try again.'); }
  const intent = record(parsed);
  for (const key of Object.keys(intent)) {
    if (!['summary', 'params', 'missing', 'questions'].includes(key)) throw new Error('Meta returned an unsupported intent field. No desktop action was taken.');
  }
  const summary = boundedText(intent.summary, 500, 'summary');
  const paramsSource = record(intent.params);
  const paramKeys = Object.keys(paramsSource);
  if (paramKeys.length > 20) throw new Error('Meta returned too many intent values. No desktop action was taken.');
  const params: Record<string, string> = {};
  for (const key of paramKeys) {
    if (!key.trim() || key.length > 64 || key.includes('\0')) throw new Error('Meta returned an invalid intent value name.');
    const candidate = paramsSource[key];
    if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > 200 || candidate.includes('\0')) {
      throw new Error('Meta returned an invalid intent value.');
    }
    params[key] = candidate;
  }
  if (!Array.isArray(intent.missing)) throw new Error('Meta returned an invalid intent response. No desktop action was taken.');
  if (intent.missing.length > 20) throw new Error('Meta returned too many missing values. No desktop action was taken.');
  const missing = intent.missing.map(item => boundedText(item, 200, 'missing value'));
  let questions: ClarificationQuestion[] | undefined;
  if (intent.questions !== undefined) {
    if (!Array.isArray(intent.questions) || intent.questions.length > 3) {
      throw new Error('Meta returned an invalid intent question list. No desktop action was taken.');
    }
    questions = intent.questions.map(item => {
      const entry = record(item);
      for (const key of Object.keys(entry)) {
        if (!['id', 'question', 'options'].includes(key)) throw new Error('Meta returned an unsupported intent question field. No desktop action was taken.');
      }
      const id = boundedText(entry.id, 32, 'question id');
      const question = boundedText(entry.question, 300, 'question');
      if (!Array.isArray(entry.options) || entry.options.length > 4) {
        throw new Error('Meta returned an invalid intent option list. No desktop action was taken.');
      }
      const options = entry.options.map(option => boundedText(option, 100, 'question option'));
      return { id, question, options };
    });
  }
  return {
    intent: { summary, params, missing, ...(questions === undefined ? {} : { questions }) },
    inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens),
  };
}
