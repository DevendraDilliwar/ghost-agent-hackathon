// Captures one real SAM 3.1 response for parser development (Test 2).
// Usage (on the VM, key never leaves your shell):
//   export META_API_KEY=your-key
//   xfce4-screenshooter -f /tmp/shot.png
//   node scripts/capture-sam.mjs /tmp/shot.png "the blue login button" /tmp/sam-response.json
// Then share /tmp/sam-response.json so the mask parser can be written against the real shape.
// Request shape mirrors src/providers/meta/sam-grounding.ts exactly.
import { readFile, writeFile } from 'node:fs/promises';

const [, , pngPath, query, outPath = '/tmp/sam-response.json'] = process.argv;
const apiKey = process.env.META_API_KEY?.trim();
if (!apiKey) {
  console.error('Set META_API_KEY first: export META_API_KEY=your-key');
  process.exit(1);
}
if (!pngPath || !query) {
  console.error('Usage: node scripts/capture-sam.mjs <shot.png> "<query>" [out.json]');
  process.exit(1);
}

const bytes = await readFile(pngPath);
const form = new FormData();
form.append('purpose', 'user_data');
form.append('file', new Blob([bytes], { type: 'image/png' }), 'screenshot.png');

const upload = await fetch('https://api.meta.ai/v1/files', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
  headers: { Authorization: 'Bearer ' + apiKey }, body: form,
});
if (!upload.ok) throw new Error('SAM upload failed (HTTP ' + upload.status + ').');
const { id: fileId } = await upload.json();
if (typeof fileId !== 'string' || !fileId) throw new Error('SAM upload returned no file id.');

const response = await fetch('https://api.meta.ai/v1/responses', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
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
if (!response.ok) throw new Error('SAM request failed (HTTP ' + response.status + ').');
const text = await response.text();
await writeFile(outPath, text);
console.log('Saved ' + text.length + ' bytes to ' + outPath);
