import type { MetaModelId } from '../../shared/contracts/model';

export interface MetaConfiguration { readonly apiKey: string; readonly model: MetaModelId; readonly verifyModel?: MetaModelId }

function transientError(message: string): Error {
  return Object.assign(new Error(message), { transient: true });
}

function isTransient(error: unknown): boolean {
  return error instanceof Error && (error as { transient?: unknown }).transient === true;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function attemptMetaRequest(config: MetaConfiguration, body: Record<string, unknown>, signal: AbortSignal, request: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await request('https://api.meta.ai/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      headers: { Authorization: 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: config.model, store: false }),
    });
  } catch {
    signal.throwIfAborted();
    throw transientError('Could not reach Meta within 30 seconds. Check your connection and try again.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const messages: Record<number, string> = {
      401: 'Meta authentication failed. Check the model API credential.',
      402: 'Meta credits or billing are unavailable for this request.',
      403: 'This Meta model or account is not permitted to use the endpoint.',
    };
    if (response.status === 429 || response.status >= 500) {
      throw transientError(response.status === 429
        ? 'Meta rate limit reached. Wait before trying again.'
        : 'Meta request failed (HTTP ' + response.status + ').');
    }
    throw new Error(messages[response.status] ?? 'Meta request failed (HTTP ' + response.status + ').');
  }
  if (!response.body) throw new Error('Meta returned an empty response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > 1_048_576) throw new Error('Meta response exceeded the supported size.');
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
    catch { throw new Error('Meta returned invalid JSON. No action was executed.'); }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function requestMeta(config: MetaConfiguration, body: Record<string, unknown>, signal: AbortSignal, request: typeof fetch = fetch): Promise<unknown> {
  if (!config.apiKey) throw new Error('Connect your Meta API key in Settings first.');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await attemptMetaRequest(config, body, signal, request);
    } catch (error) {
      signal.throwIfAborted();
      if (!isTransient(error) || attempt === 3) throw error;
      await sleep(1000 * attempt, signal);
    }
  }
  throw new Error('Meta request failed after 3 attempts.');
}

export async function testMetaConnection(config: MetaConfiguration, signal: AbortSignal, request: typeof fetch = fetch): Promise<void> {
  const data = await requestMeta(config, { max_output_tokens: 512, input: 'Reply with exactly: GHOST_API_OK' }, signal, request);
  if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'completed' || !('output' in data) || !Array.isArray(data.output)) {
    throw new Error('Meta did not complete the connection test. Try again.');
  }
  const text = data.output.flatMap((item: { type?: unknown; content?: unknown }) => item?.type === 'message' && Array.isArray(item.content) ? item.content : [])
    .filter((item: { type?: unknown; text?: unknown }) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item: { text: string }) => item.text).join('').trim();
  if (text !== 'GHOST_API_OK') throw new Error('Meta returned an unexpected connection-test response. Try again.');
}
