import { describe, expect, it } from 'vitest';
import { parseSourceResponse } from './parse-source';

function response(overrides: Record<string, unknown> = {}, text = '{"text":"BILL-1 Total 100","lowConfidence":false}'): unknown {
  return {
    status: 'completed', usage: { input_tokens: 70, output_tokens: 30 },
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    ...overrides,
  };
}

describe('source response parser', () => {
  it('parses a confident transcript with token usage', () => {
    expect(parseSourceResponse(response())).toEqual({ text: 'BILL-1 Total 100', lowConfidence: false, inputTokens: 70, outputTokens: 30 });
  });

  it('allows empty text with low confidence (the controller decides readability)', () => {
    const result = parseSourceResponse(response({}, '{"text":"","lowConfidence":true}'));
    expect(result).toMatchObject({ text: '', lowConfidence: true });
  });

  it('reports incomplete, failed, and unsupported statuses without touching the desktop', () => {
    expect(() => parseSourceResponse(response({ status: 'incomplete' }))).toThrow('stopped while reading the source image');
    expect(() => parseSourceResponse(response({ status: 'failed' }))).toThrow('could not read the source image');
    expect(() => parseSourceResponse(response({ status: 'queued' }))).toThrow('unsupported source response');
  });

  it('rejects malformed payloads, wrong keys, and oversize text', () => {
    expect(() => parseSourceResponse(response({}, 'not-json'))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({}, '{"text":"x"}'))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({}, '{"text":"x","lowConfidence":false,"extra":1}'))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({}, '{"text":"x","lowConfidence":"maybe"}'))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({}, '{"text":"' + 'x'.repeat(16_001) + '","lowConfidence":false}'))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({ output: [] }))).toThrow('unsupported source response');
    expect(() => parseSourceResponse(response({ usage: { input_tokens: -1, output_tokens: 0 } }))).toThrow('unsupported source response');
  });
});
