import { describe, expect, it, vi } from 'vitest';
import { requestSamMasks, uploadScreenshotForGrounding } from './sam-grounding';

const signal = () => new AbortController().signal;
const shot = 'data:image/png;base64,aGk=';

describe('SAM 3.1 grounding transport', () => {
  it('uploads the screenshot as multipart user data and returns the file id', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'file-123' })));
    const id = await uploadScreenshotForGrounding('test-key', shot, signal(), request);
    expect(id).toBe('file-123');
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.meta.ai/v1/files');
    expect(options?.method).toBe('POST');
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const form = options?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('purpose')).toBe('user_data');
    const file = form.get('file') as File;
    expect(file.name).toBe('screenshot.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(2);
  });

  it('refuses a non-PNG data URL and an upload without a file id', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(uploadScreenshotForGrounding('test-key', 'data:image/jpeg;base64,aGk=', signal(), request))
      .rejects.toThrow('PNG screenshot data URL');
    expect(request).not.toHaveBeenCalled();
    await expect(uploadScreenshotForGrounding('test-key', shot, signal(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({}))))).rejects.toThrow('unexpected response');
  });

  it('maps upload failures without exposing raw provider output', async () => {
    await expect(uploadScreenshotForGrounding('test-key', shot, signal(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('private-debug', { status: 401 })))).rejects.toThrow('Meta authentication failed.');
    await expect(uploadScreenshotForGrounding('test-key', shot, signal(),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('private network diagnostics')))).rejects.toThrow('Could not reach Meta within 30 seconds');
  });

  it('sends the documented sam-3.1 request and returns the streamed result object', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      'event: response.completed\ndata: {"status":"completed","output":[]}\n\ndata: [DONE]\n\n'));
    const payload = await requestSamMasks('test-key', 'file-123', 'button', signal(), request);
    expect(payload).toEqual({ status: 'completed', output: [] });
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.meta.ai/v1/responses');
    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe('sam-3.1');
    expect(body.stream).toBe(true);
    expect(body.metadata).toEqual({ mask_encoding: 'lossless', include_confidence: 'true' });
    expect(body.input[0].content[0]).toEqual({ type: 'input_text', text: 'button' });
    expect(body.input[0].content[1]).toEqual({ type: 'input_image', file_id: 'file-123' });
    expect(String(options?.body)).not.toContain('test-key');
  });

  it('unwraps a completed-event envelope and rejects a garbage stream', async () => {
    const nested = await requestSamMasks('test-key', 'file-123', 'button', signal(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('data: {"type":"response.completed","response":{"status":"completed"}}\n\n')));
    expect(nested).toEqual({ status: 'completed' });
    await expect(requestSamMasks('test-key', 'file-123', 'button', signal(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response(': keep-alive\n\n')))).rejects.toThrow('unexpected streamed response');
  });

  it('maps SAM request failures without exposing raw provider output', async () => {
    await expect(requestSamMasks('test-key', 'file-123', 'button', signal(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('private-debug', { status: 401 })))).rejects.toThrow('Meta authentication failed.');
    await expect(requestSamMasks('test-key', 'file-123', '', signal(), vi.fn<typeof fetch>()))
      .rejects.toThrow('short search phrase');
  });
});
