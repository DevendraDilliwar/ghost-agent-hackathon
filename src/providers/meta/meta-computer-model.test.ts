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

  it('keeps the whole batch with provider safety warnings for explicit action review', () => {
    const decision = parseMetaDecision({
      ...response,
      output: [{ type: 'computer_call', actions: [{ type: 'wait' }, { type: 'screenshot' }], pending_safety_checks: [{ message: 'Review the action carefully.' }] }],
    }, frame);
    expect(decision.action).toEqual({ type: 'wait' });
    expect(decision.actions).toEqual([{ type: 'wait' }, { type: 'screenshot' }]);
    expect(decision.warnings).toHaveLength(1);
    expect(decision.warnings).toContain('Review the action carefully.');
  });

  it('caps a batch at five actions with a warning', () => {
    const decision = parseMetaDecision({
      ...response,
      output: [{ type: 'computer_call', actions: [{ type: 'wait' }, { type: 'wait' }, { type: 'wait' }, { type: 'wait' }, { type: 'wait' }, { type: 'wait' }] }],
    }, frame);
    expect(decision.actions).toHaveLength(5);
    expect(decision.warnings).toContain('Only the first 5 actions will execute. The agent will observe again before deciding another batch.');
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
    expect(() => parseMetaDecision({ ...response, output: [{ ...help, name: 'unknown_tool' }] }, frame)).toThrow('unsupported handoff');
    expect(() => parseMetaDecision({ ...response, output: [{ ...help, arguments: JSON.stringify({ kind: 'verification', reason: '' }) }] }, frame)).toThrow('invalid handoff');
  });

  it('parses a run_shell call and never combines it with a desktop action', () => {
    const shell = { type: 'function_call', name: 'run_shell', arguments: JSON.stringify({ command: 'mkdir -p ~/Documents/Expense-Nov' }) };
    const decision = parseMetaDecision({ ...response, output: [shell] }, frame);
    expect(decision.action).toBeNull();
    expect(decision.shell).toEqual({ command: 'mkdir -p ~/Documents/Expense-Nov' });
    expect(() => parseMetaDecision({ ...response, output: [shell, ...response.output] }, frame)).toThrow('Multiple tool');
    expect(() => parseMetaDecision({ ...response, output: [{ ...shell, arguments: '{' }] }, frame)).toThrow('invalid shell call');
    expect(() => parseMetaDecision({ ...response, output: [{ ...shell, arguments: JSON.stringify({ command: '' }) }] }, frame)).toThrow('invalid shell call');
    expect(() => parseMetaDecision({ ...response, output: [{ ...shell, arguments: JSON.stringify({ command: 'x'.repeat(2001) }) }] }, frame)).toThrow('invalid shell call');
  });

  it('holds desktop actions unvalidated when no screenshot is available yet', () => {
    const decision = parseMetaDecision(response, undefined);
    expect(decision.action).toBeNull();
    expect(decision.pendingActions).toEqual([{ type: 'click', x: 50, y: 60, button: 'left' }]);
    expect(() => parseMetaDecision({ ...response, output: [{ type: 'computer_call', actions: [] }] }, undefined)).toThrow('invalid action list');
    expect(() => parseMetaDecision({ ...response, output: [{ type: 'computer_call', actions: new Array(21).fill({ type: 'wait' }) }] }, undefined)).toThrow('invalid action list');
  });

  it('decides from text alone after a terminal command, sending no screenshot', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', usage: { input_tokens: 40, output_tokens: 8 },
      output: [{ type: 'function_call', name: 'run_shell', arguments: JSON.stringify({ command: 'ls' }) }],
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    const decision = await model.decide({ goal: 'List files', history: ['executed: $ pwd'], signal: new AbortController().signal });
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(JSON.stringify(body.input)).not.toContain('input_image');
    expect(JSON.stringify(body.input)).toContain('No screenshot was taken');
    expect(body.tools.map((tool: { name?: string; type: string }) => tool.name ?? tool.type)).toContain('run_shell');
    expect(decision.shell).toEqual({ command: 'ls' });
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

  it('gives goal understanding the same output allowance as decisions', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', usage: { input_tokens: 50, output_tokens: 20 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"summary":"Install VS Code","params":{},"missing":[]}' }] }],
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    const result = await model.parseIntent({ goal: 'Install VS Code', clarifications: [], signal: new AbortController().signal });
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.max_output_tokens).toBe(4096);
    expect(body.tools).toBeUndefined();
    expect(result.intent.summary).toBe('Install VS Code');
  });

  it('routes verification to the Wonder model when configured, keeping planning on Spark', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', usage: { input_tokens: 60, output_tokens: 12 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"confirmed":true,"detail":"Text is visible."}' }] }],
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3', verifyModel: 'muse-wonder-1.0' }, request);
    const result = await model.verifyText({ text: '75000', observation: frame, signal: new AbortController().signal });
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.model).toBe('muse-wonder-1.0');
    expect(result).toMatchObject({ confirmed: true, inputTokens: 60, outputTokens: 12 });
  });

  it('plans ordered domain phases without tools or screenshots', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', usage: { input_tokens: 45, output_tokens: 18 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"phases":[{"domain":"github","goal":"Push code","success":"Push succeeded"},{"domain":"gcp","goal":"Deploy backend","steps":["Create the service","Deploy"],"success":"Service URL serves traffic"}]}' }] }],
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3' }, request);
    const result = await model.plan({ goal: 'Ship the repo', signal: new AbortController().signal });
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.tools).toBeUndefined();
    expect(body.max_output_tokens).toBe(4096);
    expect(String(request.mock.calls[0]![1]?.body)).not.toContain('data:image');
    expect(result.phases).toEqual([
      { domain: 'github', goal: 'Push code', steps: [], success: 'Push succeeded' },
      { domain: 'gcp', goal: 'Deploy backend', steps: ['Create the service', 'Deploy'], success: 'Service URL serves traffic' },
    ]);
    expect(result).toMatchObject({ inputTokens: 45, outputTokens: 18 });
  });

  it('verifies phase success conditions against a screenshot without tools', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', usage: { input_tokens: 55, output_tokens: 9 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"confirmed":false,"detail":"Still on the loading screen."}' }] }],
    })));
    const model = new MetaComputerModel({ apiKey: 'test-key', model: 'muse-spark-1.3', verifyModel: 'muse-wonder-1.0' }, request);
    const result = await model.verifySuccess({ condition: 'Deployment URL is live', observation: frame, signal: new AbortController().signal });
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.model).toBe('muse-wonder-1.0');
    expect(body.tools).toBeUndefined();
    expect(result).toMatchObject({ confirmed: false, detail: 'Still on the loading screen.', inputTokens: 55, outputTokens: 9 });
  });

});
