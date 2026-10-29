import type { MetaModelId } from '../../shared/contracts/model';

export interface MetaConfiguration { readonly apiKey: string; readonly model: MetaModelId }

export async function requestMeta(config: MetaConfiguration, body: Record<string, unknown>, signal: AbortSignal, request: typeof fetch = fetch): Promise<unknown> {
  if (!config.apiKey) throw new Error('Connect your Meta API key in Settings first.');
  let response: Response;
  try {
    response = await request('https://api.meta.ai/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      headers: { Authorization: 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: config.model, store: false }),
    });
  } catch {
    signal.throwIfAborted();
    throw new Error('Could not reach Meta within 30 seconds. Check your connection and try again.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const messages: Record<number, string> = {
      401: 'Meta authentication failed. Check the model API credential.',
      402: 'Meta credits or billing are unavailable for this request.',
      403: 'This Meta model or account is not permitted to use the endpoint.',
      429: 'Meta rate limit reached. Wait before trying again.',
    };
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
