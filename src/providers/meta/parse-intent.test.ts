import { describe, expect, it } from 'vitest';
import { parseIntentResponse } from './parse-intent';

function envelope(text: string, usage: unknown = { input_tokens: 50, output_tokens: 12 }) {
  return {
    status: 'completed',
    usage,
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  };
}

const valid = JSON.stringify({
  summary: 'Enter the sales voucher',
  params: { date: '12-10-2026', amount: '25000' },
  missing: ['ledger'],
});

describe('parseIntentResponse', () => {
  it('parses a valid intent with token usage', () => {
    const result = parseIntentResponse(envelope(valid));
    expect(result.intent).toEqual({
      summary: 'Enter the sales voucher',
      params: { date: '12-10-2026', amount: '25000' },
      missing: ['ledger'],
    });
    expect(result.inputTokens).toBe(50);
    expect(result.outputTokens).toBe(12);
  });

  it('rejects non-JSON text', () => {
    expect(() => parseIntentResponse(envelope('Sure, I will enter the voucher.'))).toThrow('did not return intent as JSON');
  });

  it('rejects a non-object payload', () => {
    expect(() => parseIntentResponse(envelope('[1, 2]'))).toThrow('invalid intent response');
  });

  it('rejects a missing summary', () => {
    expect(() => parseIntentResponse(envelope(JSON.stringify({ params: {}, missing: [] })))).toThrow('invalid intent summary');
  });

  it('rejects non-string param values', () => {
    const text = JSON.stringify({ summary: 'Do it', params: { amount: 25000 }, missing: [] });
    expect(() => parseIntentResponse(envelope(text))).toThrow('invalid intent value');
  });

  it('rejects more than 20 params', () => {
    const params: Record<string, string> = {};
    for (let i = 0; i < 21; i++) params['p' + i] = 'v';
    const text = JSON.stringify({ summary: 'Do it', params, missing: [] });
    expect(() => parseIntentResponse(envelope(text))).toThrow('too many intent values');
  });

  it('rejects unknown top-level fields', () => {
    const text = JSON.stringify({ summary: 'Do it', params: {}, missing: [], confidence: 0.9 });
    expect(() => parseIntentResponse(envelope(text))).toThrow('unsupported intent field');
  });

  it('rejects a failed response without acting', () => {
    expect(() => parseIntentResponse({ status: 'failed' })).toThrow('could not understand');
  });

  it('rejects invalid token usage', () => {
    expect(() => parseIntentResponse(envelope(valid, { input_tokens: -1, output_tokens: 12 }))).toThrow('valid token usage');
  });
});
