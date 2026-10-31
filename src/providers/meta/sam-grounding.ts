/**
 * SAM 3.1 grounding transport.
 *
 * Milestone: screenshot upload + streamed mask request + error mapping.
 * The mask/box parser and the per-step loop wiring land once a real SAM
 * response is captured against a desktop screenshot (Test 2). Until then
 * nothing in the live loop calls this module, so no step spends credits
 * or latency on an unwired provider.
 */

const FILES_URL = 'https://api.meta.ai/v1/files';
const RESPONSES_URL = 'https://api.meta.ai/v1/responses';

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

/** Uploads a PNG screenshot for SAM segmentation. Returns the file id. */
export async function uploadScreenshotForGrounding(apiKey: string, imageDataUrl: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<string> {
  if (!apiKey) throw new Error('Connect your Meta API key in Settings first.');
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl.trim());
  if (!match?.[1]) throw new Error('SAM grounding needs a PNG screenshot data URL.');
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new Blob([Buffer.from(match[1], 'base64')], { type: 'image/png' }), 'screenshot.png');
  let response: Response;
  try {
    response = await request(FILES_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      headers: { Authorization: 'Bearer ' + apiKey }, body: form,
    });
  } catch {
    signal.throwIfAborted();
    throw new Error('Could not reach Meta within 30 seconds. Check your connection and try again.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(response.status === 401
      ? 'Meta authentication failed. Check the model API credential.'
      : 'SAM upload failed (HTTP ' + response.status + ').');
  }
  const id = record(await response.json() as unknown, 'SAM upload returned an unexpected response.').id;
  if (typeof id !== 'string' || !id) throw new Error('SAM upload returned an unexpected response.');
  return id;
}

/** Runs text-prompted SAM segmentation over an uploaded screenshot. Returns the streamed result payload. */
export async function requestSamMasks(apiKey: string, fileId: string, query: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<unknown> {
  if (!apiKey) throw new Error('Connect your Meta API key in Settings first.');
  if (!fileId || !query.trim() || query.length > 200) throw new Error('SAM grounding needs an uploaded screenshot and a short search phrase.');
  let response: Response;
  try {
    response = await request(RESPONSES_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        model: 'sam-3.1', stream: true,
        metadata: { mask_encoding: 'lossless', include_confidence: 'true' },
        input: [{ type: 'message', role: 'user', content: [
          { type: 'input_text', text: query },
          { type: 'input_image', file_id: fileId },
        ] }],
      }),
    });
  } catch {
    signal.throwIfAborted();
    throw new Error('Could not reach Meta within 60 seconds. Check your connection and try again.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(response.status === 401
      ? 'Meta authentication failed. Check the model API credential.'
      : 'SAM request failed (HTTP ' + response.status + ').');
  }
  return readStreamedPayload(response, signal);
}

async function readStreamedPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new Error('SAM returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      text += decoder.decode(result.value, { stream: true });
      if (text.length > 8_000_000) throw new Error('SAM response exceeded the supported size.');
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  signal.throwIfAborted();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not a plain JSON body: fall through to SSE event parsing.
  }
  let payload: unknown = null;
  for (const line of text.split('\n')) {
    const data = line.startsWith('data:') ? line.slice(5).trim() : '';
    if (!data || data === '[DONE]') continue;
    try {
      const event: unknown = JSON.parse(data);
      // Segmentation results arrive as one complete object, not token deltas.
      if (event && typeof event === 'object') payload = event;
    } catch {
      // Ignore keep-alive comments and partial lines.
    }
  }
  const event = record(payload, 'SAM returned an unexpected streamed response.');
  const inner = event.response;
  return inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : event;
}
