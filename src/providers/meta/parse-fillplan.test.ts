import { describe, expect, it } from 'vitest';
import { parseFillPlanResponse } from './parse-fillplan';

function envelope(text: string, status = 'completed'): unknown {
  return { status, usage: { input_tokens: 30, output_tokens: 12 },
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }] };
}

describe('fill-plan response parsing', () => {
  it('parses ordered units with chunking and a start hint', () => {
    const result = parseFillPlanResponse(envelope('{"units":[{"cells":["Lamp","12","450"]},'
      + '{"cells":["Chair","8","1200"]}],"chunkRows":5,"startHint":"first empty row"}'));
    expect(result.units).toEqual([{ cells: ['Lamp', '12', '450'] }, { cells: ['Chair', '8', '1200'] }]);
    expect(result.chunkRows).toBe(5);
    expect(result.startHint).toBe('first empty row');
    expect(result).toMatchObject({ inputTokens: 30, outputTokens: 12 });
  });

  it('accepts an empty unit list for non-entry goals', () => {
    const result = parseFillPlanResponse(envelope('{"units":[]}'));
    expect(result.units).toEqual([]);
    expect(result.chunkRows).toBe(5);
    expect(result.startHint).toBe('');
  });

  it('clamps chunk rows, caps the hint, and strips trailing empty cells', () => {
    const result = parseFillPlanResponse(envelope('{"units":[{"cells":["a","1","",""]}],"chunkRows":99,"startHint":"'
      + 'h'.repeat(300) + '"}'));
    expect(result.units).toEqual([{ cells: ['a', '1'] }]);
    expect(result.chunkRows).toBe(10);
    expect(result.startHint).toHaveLength(200);
  });

  it('rejects oversized or misshapen fill plans', () => {
    const big = '{"units":[' + '{"cells":["a"]},'.repeat(201).slice(0, -1) + ']}';
    expect(() => parseFillPlanResponse(envelope(big))).toThrow('invalid fill-unit list');
    expect(() => parseFillPlanResponse(envelope('{"units":[{"cells":[]}]}'))).toThrow('cell list');
    expect(() => parseFillPlanResponse(envelope('{"units":[{"cells":["' + 'x'.repeat(201) + '"]}]}'))).toThrow('cell');
    expect(() => parseFillPlanResponse(envelope('{"units":[],"extra":1}'))).toThrow('unsupported fill-plan field');
    expect(() => parseFillPlanResponse(envelope('{"units":[{"cells":["a"],"extra":1}]}'))).toThrow('unsupported fill-unit field');
  });

  it('rejects unfinished, failed, and non-JSON responses', () => {
    expect(() => parseFillPlanResponse(envelope('{}', 'incomplete'))).toThrow('stopped while listing');
    expect(() => parseFillPlanResponse(envelope('{}', 'failed'))).toThrow('could not list');
    expect(() => parseFillPlanResponse(envelope('not json'))).toThrow('as JSON');
    expect(() => parseFillPlanResponse({ status: 'completed' })).toThrow('invalid fill-plan response');
  });
});
