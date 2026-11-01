import type { ModelDecision } from '../../agent/ports';
import type { DesktopCommand, ScreenObservation } from '../../shared/contracts/desktop';
import { validateDesktopCommand } from '../../policy/task-validation';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw malformed('Meta returned an invalid response.');
  return value as Record<string, unknown>;
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw malformed('Meta did not return valid token usage.');
  return value;
}

/** Flags malformed model output so the controller retries once with correction guidance. */
function malformed(message: string): Error {
  return Object.assign(new Error(message), { malformedModelOutput: true });
}

function parseSafetyChecks(call: Record<string, unknown>, warnings: string[]): void {
  if (call.pending_safety_checks === undefined) return;
  if (!Array.isArray(call.pending_safety_checks) || call.pending_safety_checks.length > 10) throw malformed('Invalid provider safety checks.');
  for (const check of call.pending_safety_checks) {
    const item = object(check);
    if (typeof item.message !== 'string') throw malformed('Invalid provider safety check.');
    warnings.push(item.message.slice(0, 1000));
  }
}

export function parseMetaDecision(value: unknown, observation?: ScreenObservation): ModelDecision {
  const response = object(value);
  if (response.status === 'incomplete') {
    const details = response.incomplete_details;
    const reason = details && typeof details === 'object' && 'reason' in details ? details.reason : null;
    if (reason === 'max_output_tokens') {
      const usage = response.usage;
      const count = usage && typeof usage === 'object' && 'output_tokens' in usage ? usage.output_tokens : null;
      const usageText = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? ' (' + count + ' output tokens used)' : '';
      throw new Error('Meta reached the response token limit before finishing its decision' + usageText + '. No action from this response was executed. Try a smaller task; if this repeats, the model response budget needs adjustment.');
    }
    if (reason === 'content_filter') throw new Error('Meta stopped this response because of a content filter. No action from this response was executed. Review the task and screen content.');
    throw new Error('Meta returned an incomplete decision without a supported reason. No action from this response was executed.');
  }
  if (response.status === 'failed') throw new Error('Meta could not complete this decision. No action from this response was executed. Try again later.');
  if (response.status !== 'completed') throw new Error('Meta returned an unsupported response status. No action from this response was executed.');
  if (!Array.isArray(response.output)) throw malformed('Meta returned an invalid output list. No action from this response was executed.');
  const usage = object(response.usage);
  const output = response.output.map(object);
  if (output.some(item => item.status !== undefined && item.status !== null && item.status !== 'completed')) {
    throw malformed('Meta returned an incomplete output item. No action from this response was executed.');
  }
  const calls = output.filter(item => item.type === 'computer_call');
  const functions = output.filter(item => item.type === 'function_call');
  if (calls.length + functions.length > 1) throw malformed('Multiple tool calls in one decision are not supported.');
  const warnings: string[] = [];
  const message = output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : [])
    .map(object).filter(item => item.type === 'output_text' && typeof item.text === 'string')
    .map(item => String(item.text).slice(0, 6000)).join('\n').slice(0, 6000);
  const call = calls[0];
  if (functions.length) {
    const handoff = functions[0]!;
    if (handoff.name === 'run_shell') {
      if (typeof handoff.arguments !== 'string' || handoff.arguments.length > 4096) throw malformed('Meta returned an unsupported shell call.');
      let shellArgs: unknown;
      try { shellArgs = JSON.parse(handoff.arguments) as unknown; }
      catch { throw malformed('Meta returned an invalid shell call.'); }
      const shellCommand = object(shellArgs).command;
      if (typeof shellCommand !== 'string' || !shellCommand.trim() || shellCommand.length > 2000 || shellCommand.includes('\0')) {
        throw malformed('Meta returned an invalid shell call.');
      }
      return { action: null, shell: { command: shellCommand.trim() }, message, warnings,
        inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
    }
    if (handoff.name !== 'request_user_help' || typeof handoff.arguments !== 'string' || handoff.arguments.length > 4096) throw malformed('Meta returned an unsupported handoff.');
    let argumentsValue: unknown;
    try { argumentsValue = JSON.parse(handoff.arguments) as unknown; }
    catch { throw malformed('Meta returned an invalid handoff.'); }
    const args = object(argumentsValue);
    if (!['verification', 'login', 'clarification'].includes(String(args.kind)) || typeof args.reason !== 'string' || !args.reason.trim() || args.reason.length > 1000) throw malformed('Meta returned an invalid handoff.');
    return { action: null, message, warnings, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens),
      handoff: { kind: args.kind as 'verification' | 'login' | 'clarification', reason: args.reason.trim() } };
  }
  let action = null;
  let actions: DesktopCommand[] | undefined;
  if (call) {
    if (!Array.isArray(call.actions) || call.actions.length < 1 || call.actions.length > 20) throw malformed('Meta returned an invalid action list.');
    if (!observation) {
      // Text-mode decision (after a shell step): hold the actions unvalidated so the
      // controller captures a fresh screenshot and validates them instead of dying.
      parseSafetyChecks(call, warnings);
      return { action: null, pendingActions: [...call.actions], message, warnings,
        inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens) };
    }
    let batch;
    try {
      batch = call.actions.slice(0, 5).map(entry => validateDesktopCommand(entry, observation));
    } catch (error) {
      throw malformed(error instanceof Error ? error.message : 'Meta returned an invalid desktop action.');
    }
    action = batch[0]!;
    actions = batch;
    if (call.actions.length > 5) warnings.push('Only the first 5 actions will execute. The agent will observe again before deciding another batch.');
    parseSafetyChecks(call, warnings);
  } else if (!message) {
    throw malformed('Meta returned neither an action nor a result.');
  }
  return { action, message, warnings, inputTokens: tokens(usage.input_tokens), outputTokens: tokens(usage.output_tokens),
    ...(actions === undefined ? {} : { actions }) };
}
