import { describe, expect, it } from 'vitest';
import { parseVerifyResponse } from './parse-verify';

function envelope(text: string, usage: unknown = { input_tokens: 40, output_tokens: 8 }) {
  return {
    status: 'completed',
    usage,
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  };
}

describe('parseVerifyResponse', () => {
  it('parses a confirmation with token usage', () => {
    const result = parseVerifyResponse(envelope(JSON.stringify({ confirmed: true, detail: 'Amount 25000 is visible.' })));
    expect(result).toEqual({ confirmed: true, detail: 'Amount 25000 is visible.', inputTokens: 40, outputTokens: 8 });
  });

  it('parses a mismatch verdict', () => {
    const result = parseVerifyResponse(envelope(JSON.stringify({ confirmed: false, detail: 'No typed value visible.' })));
    expect(result.confirmed).toBe(false);
    expect(result.detail).toBe('No typed value visible.');
  });

  it('rejects non-JSON text', () => {
    expect(() => parseVerifyResponse(envelope('Yes, it looks fine.'))).toThrow('did not return verification as JSON');
  });

  it('rejects a non-boolean confirmed flag', () => {
    const text = JSON.stringify({ confirmed: 'yes', detail: 'Visible.' });
    expect(() => parseVerifyResponse(envelope(text))).toThrow('invalid verification result');
  });

  it('rejects a missing detail', () => {
    expect(() => parseVerifyResponse(envelope(JSON.stringify({ confirmed: true })))).toThrow('invalid verification detail');
  });

  it('rejects unknown top-level fields', () => {
    const text = JSON.stringify({ confirmed: true, detail: 'Visible.', score: 0.9 });
    expect(() => parseVerifyResponse(envelope(text))).toThrow('unsupported verification field');
  });

  it('rejects a failed response without acting', () => {
    expect(() => parseVerifyResponse({ status: 'failed' })).toThrow('could not verify');
  });

  it('rejects invalid token usage', () => {
    const text = JSON.stringify({ confirmed: true, detail: 'Visible.' });
    expect(() => parseVerifyResponse(envelope(text, { input_tokens: 40 }))).toThrow('valid token usage');
  });
});
