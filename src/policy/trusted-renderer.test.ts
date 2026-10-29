import { describe, expect, it } from 'vitest';
import { getContentSecurityPolicy, isTrustedRenderer } from './trusted-renderer';

describe('renderer trust boundary', () => {
  it('permits the configured renderer URL', () => {
    expect(isTrustedRenderer('http://127.0.0.1:5173/', 'http://127.0.0.1:5173')).toBe(true);
    expect(isTrustedRenderer('file:///app/out/renderer/index.html', 'file:///app/out/renderer/index.html')).toBe(true);
  });

  it.each([
    'http://127.0.0.1:5174/',
    'http://127.0.0.1.attacker.test:5173/',
    'http://127.0.0.1:5173@attacker.test/',
    'https://127.0.0.1:5173/',
    'http://127.0.0.1:5173/untrusted.html',
    'http://127.0.0.1:5173/?redirect=https://attacker.test',
    'about:blank',
    'not a URL',
  ])('rejects an unexpected frame: %s', (url) => {
    expect(isTrustedRenderer(url, 'http://127.0.0.1:5173/')).toBe(false);
  });

  it('rejects another local file and malformed configuration', () => {
    expect(isTrustedRenderer('file:///tmp/untrusted.html', 'file:///app/out/renderer/index.html')).toBe(false);
    expect(isTrustedRenderer('file:///app/out/renderer/index.html', 'broken')).toBe(false);
    expect(isTrustedRenderer('javascript:alert(1)', 'javascript:alert(1)')).toBe(false);
  });

  it('keeps development-only script and network permissions out of production', () => {
    const policy = getContentSecurityPolicy(false);
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).not.toContain('ws:');
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
