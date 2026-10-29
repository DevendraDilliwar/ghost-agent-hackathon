import type { ModelDecision } from '../../agent/ports';
import type { ScreenObservation } from '../../shared/contracts/desktop';
import { validateDesktopCommand } from '../../policy/task-validation';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Meta returned an invalid response.');
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Meta did not return valid token usage.');
  return value;
}

export function parseMetaDecision(value: unknown, observation: ScreenObservation): ModelDecision {
  const response = object(value);
  if (response.status !== 'completed' || !Array.isArray(response.output)) {
    throw new Error('Meta returned an incomplete or unsupported response. No action was executed.');
  }
  const usage = object(response.usage);
  const output = response.output.map(object);
  const calls = output.filter(item => item.type === 'computer_call');
  const functions = output.filter(item => item.type === 'function_call');
  if (calls.length + functions.length > 1) throw new Error('Multiple tool calls in one decision are not supported.');
  const warnings: string[] = [];
  const message = output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : [])
    .map(object).filter(item => item.type === 'output_text' && typeof item.text === 'string')
    .map(item => String(item.text).slice(0, 6000)).join('\n').slice(0, 6000);
  const call = calls[0];
  if (functions.length) {
    const handoff = functions[0]!;
    if (handoff.name !== 'request_user_help' || typeof handoff.arguments !== 'string' || handoff.arguments.length > 4096) throw new Error('Meta returned an unsupported handoff.');
    let argumentsValue: unknown;
    try { argumentsValue = JSON.parse(handoff.arguments) as unknown; }
    catch { throw new Error('Meta returned an invalid handoff.'); }
    const args = object(argumentsValue);
    if (!['verification', 'login', 'clarification'].includes(String(args.kind)) || typeof args.reason !== 'string' || !args.reason.trim() || args.reason.length > 1000) throw new Error('Meta returned an invalid handoff.');
    return { action: null, message, warnings, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens),
      handoff: { kind: args.kind as 'verification' | 'login' | 'clarification', reason: args.reason.trim() } };
  }
  let action = null;
  if (call) {
    if (!Array.isArray(call.actions) || call.actions.length < 1 || call.actions.length > 20) throw new Error('Meta returned an invalid action list.');
    action = validateDesktopCommand(call.actions[0], observation);
    if (call.actions.length > 1) warnings.push('Only this first action will execute. The agent will observe again before deciding another step.');
    if (call.pending_safety_checks !== undefined) {
      if (!Array.isArray(call.pending_safety_checks) || call.pending_safety_checks.length > 10) throw new Error('Invalid provider safety checks.');
      for (const check of call.pending_safety_checks) {
        const item = object(check);
        if (typeof item.message !== 'string') throw new Error('Invalid provider safety check.');
        warnings.push(item.message.slice(0, 1000));
      }
    }
  } else if (!message) {
    throw new Error('Meta returned neither an action nor a result.');
  }
  return { action, message, warnings, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
}
