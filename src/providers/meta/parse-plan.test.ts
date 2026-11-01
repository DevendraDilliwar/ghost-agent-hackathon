import { describe, expect, it } from 'vitest';
import { parsePlanResponse } from './parse-plan';

function envelope(text: string, overrides?: Record<string, unknown>) {
  return {
    status: 'completed', usage: { input_tokens: 40, output_tokens: 12 },
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    ...overrides,
  };
}

describe('parsePlanResponse', () => {
  it('accepts a single-phase plan for simple goals', () => {
    const plan = parsePlanResponse(envelope(JSON.stringify({ phases: [{ domain: 'shared', goal: 'Change the invoice amount', success: 'Saved confirmation is visible' }] })));
    expect(plan.phases).toEqual([{ domain: 'shared', goal: 'Change the invoice amount', steps: [], success: 'Saved confirmation is visible' }]);
    expect(plan.inputTokens).toBe(40);
    expect(plan.outputTokens).toBe(12);
  });

  it('accepts an ordered multi-domain plan', () => {
    const plan = parsePlanResponse(envelope(JSON.stringify({ phases: [
      { domain: 'github', goal: 'Push code', success: 'Push succeeded' },
      { domain: 'gcp', goal: 'Deploy backend', success: 'Service URL serves traffic' },
      { domain: 'vercel', goal: 'Deploy frontend', success: 'Site renders at its URL' },
    ] })));
    expect(plan.phases.map(phase => phase.domain)).toEqual(['github', 'gcp', 'vercel']);
  });

  it('accepts agent-chosen domains outside any fixed list', () => {
    const plan = parsePlanResponse(envelope(JSON.stringify({ phases: [
      { domain: 'aws', goal: 'Provision infra', success: 'Stack shows CREATE_COMPLETE' },
      { domain: 'sap', goal: 'Post entries', success: 'Document number is shown' },
    ] })));
    expect(plan.phases.map(phase => phase.domain)).toEqual(['aws', 'sap']);
  });

  it('accepts step checklists and trims entries', () => {
    const plan = parsePlanResponse(envelope(JSON.stringify({ phases: [
      { domain: 'vercel', goal: 'Deploy frontend', steps: [' Import the repo ', 'Set env vars', 'Deploy'], success: 'Deployment URL is live' },
    ] })));
    expect(plan.phases[0]!.steps).toEqual(['Import the repo', 'Set env vars', 'Deploy']);
  });

  it.each([
    ['empty list', { phases: [] }, 'invalid phase list'],
    ['too many phases', { phases: Array.from({ length: 9 }, (_, i) => ({ domain: 'shared', goal: 'step ' + i, success: 'done' })) }, 'invalid phase list'],
    ['malformed domain', { phases: [{ domain: 'bad domain!', goal: 'Notify', success: 'done' }] }, 'invalid phase domain'],
    ['empty domain', { phases: [{ domain: '', goal: 'Notify', success: 'done' }] }, 'invalid phase domain'],
    ['empty goal', { phases: [{ domain: 'gcp', goal: '', success: 'done' }] }, 'invalid phase goal'],
    ['missing success', { phases: [{ domain: 'gcp', goal: 'Deploy' }] }, 'invalid phase success condition'],
    ['empty success', { phases: [{ domain: 'gcp', goal: 'Deploy', success: '' }] }, 'invalid phase success condition'],
    ['empty steps', { phases: [{ domain: 'gcp', goal: 'Deploy', steps: [], success: 'done' }] }, 'invalid phase step list'],
    ['bad step', { phases: [{ domain: 'gcp', goal: 'Deploy', steps: [''], success: 'done' }] }, 'invalid phase step'],
    ['oversized goal', { phases: [{ domain: 'gcp', goal: 'x'.repeat(501) }] }, 'invalid phase goal'],
    ['extra field', { phases: [{ domain: 'gcp', goal: 'Deploy', extra: 1 }] }, 'unsupported phase field'],
  ])('rejects %s without touching the desktop', (_label, body, message) => {
    expect(() => parsePlanResponse(envelope(JSON.stringify(body)))).toThrow(message);
  });

  it('rejects non-JSON and failed envelopes', () => {
    expect(() => parsePlanResponse(envelope('not json'))).toThrow('not return the plan as JSON');
    expect(() => parsePlanResponse(envelope('{}', { status: 'failed' }))).toThrow('could not plan this goal');
  });

  it('names the token limit when planning runs out of room', () => {
    expect(() => parsePlanResponse(envelope('{}', { status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 40, output_tokens: 4096 } })))
      .toThrow('response token limit while planning your goal (4096 output tokens used)');
  });

  it('names content filters and unknown stops distinctly', () => {
    expect(() => parsePlanResponse(envelope('{}', { status: 'incomplete', incomplete_details: { reason: 'content_filter' } })))
      .toThrow('content filter');
    expect(() => parsePlanResponse(envelope('{}', { status: 'incomplete' }))).toThrow('stopped while planning');
  });
});
