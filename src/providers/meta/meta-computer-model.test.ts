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
    expect(body.max_output_tokens).toBe(1200);
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
