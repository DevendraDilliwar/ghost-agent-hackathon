import { describe, expect, it, vi } from 'vitest';
import { MetaComputerModel } from './meta-computer-model';
import { parseMetaDecision } from './parse-response';
import { testMetaConnection } from './meta-request';
import type { ScreenObservation } from '../../shared/contracts/desktop';

const frame: ScreenObservation = { image: 'data:image/png;base64,c3ludGhldGlj', width: 800, height: 600, desktopWidth: 800, desktopHeight: 600, activeWindowId: '100', capturedAt: 1 };
const response = {
  status: 'completed', usage: { input_tokens: 50, output_tokens: 10 },
  output: [{ type: 'computer_call', actions: [{ type: 'click', x: 50, y: 60, button: 'left' }], pending_safety_checks: [] }],
};

describe('Meta computer-use adapter', () => {
  it('sends a bounded stateless request to the fixed endpoint without exposing a key in its input', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response)));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    const decision = await model.decide({ goal: 'Open the test page', observation: frame, history: [], signal: new AbortController().signal });
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.meta.ai/v1/responses');
    expect(options?.redirect).toBe('error');
    const body = JSON.parse(String(options?.body));
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(4096);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(String(options?.body)).not.toContain('test-key');
    expect(decision.action).toEqual({ type: 'click', x: 50, y: 60, button: 'left' });
  });

  it('does not echo provider error bodies or credentials into user-visible errors', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret-provider-debug-data', { status: 401 }));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    await expect(model.decide({ goal: 'test', observation: frame, history: [], signal: new AbortController().signal })).rejects.toThrow('Meta authentication failed.');
  });

  it('refuses an incomplete response rather than executing partial output', () => {
    expect(() => parseMetaDecision({ ...response, status: 'incomplete' }, frame)).toThrow('incomplete');
  });

  it('reports token exhaustion without accepting a partial action or retrying the request', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ...response, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
      usage: { input_tokens: 50, output_tokens: 4096 },
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    await expect(model.decide({ goal: 'Type Hello', observation: frame, history: [], signal: new AbortController().signal }))
      .rejects.toThrow('response token limit before finishing its decision (4096 output tokens used)');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ status: 'incomplete', incomplete_details: { reason: 'content_filter' } }, 'content filter'],
    [{ status: 'incomplete', incomplete_details: { reason: 'private-provider-details' } }, 'incomplete decision without a supported reason'],
    [{ status: 'failed', error: { message: 'private-provider-details' } }, 'could not complete'],
    [{ status: 'private-provider-details' }, 'unsupported response status'],
    [{ status: undefined }, 'unsupported response status'],
    [{ output: null }, 'invalid output list'],
  ])('distinguishes response failures without exposing raw provider data (%j)', (patch, message) => {
    const parse = () => parseMetaDecision({ ...response, ...patch }, frame);
    expect(parse).toThrow(message);
    expect(parse).not.toThrow('private-provider-details');
  });

  it('does not put unvalidated token values into the failure message', () => {
    for (const count of ['private-token-data', -1, Infinity, 1.5]) {
      const parse = () => parseMetaDecision({ ...response, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { output_tokens: count } }, frame);
      expect(parse).toThrow('response token limit');
      expect(parse).not.toThrow('output tokens used');
      expect(parse).not.toThrow('private-token-data');
    }
  });

  it('rejects an unfinished tool item even inside a completed response', () => {
    expect(() => parseMetaDecision({ ...response, output: [{ ...response.output[0], status: 'incomplete' }] }, frame)).toThrow('incomplete output item');
    expect(parseMetaDecision({ ...response, output: [{ ...response.output[0], status: 'completed' }] }, frame).action).toEqual({ type: 'click', x: 50, y: 60, button: 'left' });
  });

  it('validates model coordinates and token usage', () => {
    expect(() => parseMetaDecision({ ...response, output: [{ type: 'computer_call', actions: [{ type: 'click', x: 9999, y: 0 }] }] }, frame)).toThrow();
    expect(() => parseMetaDecision({ ...response, usage: undefined }, frame)).toThrow();
  });

  it('keeps provider safety warnings for explicit action review and selects only one action', () => {
    const decision = parseMetaDecision({
      ...response,
      output: [{ type: 'computer_call', actions: [{ type: 'wait' }, { type: 'screenshot' }], pending_safety_checks: [{ message: 'Review the action carefully.' }] }],
    }, frame);
    expect(decision.action).toEqual({ type: 'wait' });
    expect(decision.warnings).toHaveLength(2);
    expect(decision.warnings).toContain('Review the action carefully.');
  });

  it('sanitizes invalid JSON and rejects an oversized response', async () => {
    const input = { goal: 'test', observation: frame, history: [], signal: new AbortController().signal };
    const malformed = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' },
      vi.fn<typeof fetch>().mockResolvedValue(new Response('private-debug-payload')));
    await expect(malformed.decide(input)).rejects.toThrow('Meta returned invalid JSON.');
    const oversized = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' },
      vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(1_048_577))));
    await expect(oversized.decide(input)).rejects.toThrow('exceeded the supported size');
  });
  it('parses a structured user handoff and never combines it with a computer action', () => {
    const help = { type: 'function_call', name: 'request_user_help', arguments: JSON.stringify({ kind: 'verification', reason: 'Complete the check yourself.' }) };
    const decision = parseMetaDecision({ ...response, output: [help] }, frame);
    expect(decision.action).toBeNull();
    expect(decision.handoff).toEqual({ kind: 'verification', reason: 'Complete the check yourself.' });
    expect(() => parseMetaDecision({ ...response, output: [help, ...response.output] }, frame)).toThrow('Multiple tool');
    expect(() => parseMetaDecision({ ...response, output: [{ ...help, arguments: '{' }] }, frame)).toThrow('invalid handoff');
    expect(() => parseMetaDecision({ ...response, output: [{ ...help, name: 'run_shell' }] }, frame)).toThrow('unsupported handoff');
    expect(() => parseMetaDecision({ ...response, output: [{ ...help, arguments: JSON.stringify({ kind: 'verification', reason: '' }) }] }, frame)).toThrow('invalid handoff');
  });

  it('tests the text API with no screen data, no tools, and a bounded response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'GHOST_API_OK' }] }],
    })));
    await testMetaConnection({ apiKey: 'test-key', model: 'muse-spark-1.3' }, new AbortController().signal, request);
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(512);
    expect(body.tools).toBeUndefined();
    expect(String(request.mock.calls[0]![1]?.body)).not.toContain('image');
    expect(String(request.mock.calls[0]![1]?.body)).not.toContain('test-key');
  });

  it('does not accept an incomplete or unrelated connection-test answer as success', async () => {
    for (const data of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [] }]) {
      await expect(testMetaConnection({ apiKey: 'test-key', model: 'muse-spark-1.3' }, new AbortController().signal,
        vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data))))).rejects.toThrow();
    }
  });

  it('does not leak fetch exception details into connection errors', async () => {
    await expect(testMetaConnection({ apiKey: 'test-key', model: 'muse-spark-1.3' }, new AbortController().signal,
      vi.fn<typeof fetch>().mockRejectedValue(new Error('private network diagnostics test-key')))).rejects.toThrow('Could not reach Meta');
  });

});
