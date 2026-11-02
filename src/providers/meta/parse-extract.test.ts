import { describe, expect, it } from 'vitest';
import { parseExtractResponse } from './parse-extract';

const full = '{"billNo":"B-1","date":"12-Oct","total":"300","items":[{"name":"Pen","qty":"10","price":"50"}],"missing":[]}';

function response(overrides: Record<string, unknown> = {}, text = full): unknown {
  return {
    status: 'completed', usage: { input_tokens: 80, output_tokens: 40 },
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    ...overrides,
  };
}

describe('extract response parser', () => {
  it('parses complete bill fields with token usage', () => {
    expect(parseExtractResponse(response())).toEqual({
      billNo: 'B-1', date: '12-Oct', total: '300',
      items: [{ name: 'Pen', qty: '10', price: '50' }], missing: [],
      inputTokens: 80, outputTokens: 40,
    });
  });

  it('accepts blanks with a missing list instead of invented values', () => {
    const result = parseExtractResponse(response({}, '{"billNo":"","date":"","total":"","items":[],"missing":["date","row 1 price"]}'));
    expect(result).toMatchObject({ billNo: '', items: [], missing: ['date', 'row 1 price'] });
  });

  it('reports incomplete, failed, and unsupported statuses without touching the desktop', () => {
    expect(() => parseExtractResponse(response({ status: 'incomplete' }))).toThrow('stopped while extracting bill fields');
    expect(() => parseExtractResponse(response({ status: 'failed' }))).toThrow('could not extract bill fields');
    expect(() => parseExtractResponse(response({ status: 'queued' }))).toThrow('unsupported extract response');
  });

  it('rejects malformed payloads, wrong keys, bad rows, and oversize values', () => {
    expect(() => parseExtractResponse(response({}, 'not-json'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({}, '{"billNo":"B-1"}'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({}, full.slice(0, -1) + ',"extra":1}'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({}, '{"billNo":"B-1","date":"","total":"","items":[{"name":"Pen"}],"missing":[]}'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({}, '{"billNo":"B-1","date":"","total":"","items":[],"missing":"date"}'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({}, '{"billNo":"' + 'x'.repeat(201) + '","date":"","total":"","items":[],"missing":[]}'))).toThrow('unsupported extract response');
    expect(() => parseExtractResponse(response({ output: [] }))).toThrow('unsupported extract response');
  });
});
