export function isTrustedRenderer(frameUrl: string, rendererUrl: string): boolean {
  try {
    const frame = new URL(frameUrl);
    const expected = new URL(rendererUrl);

    if (!['file:', 'http:', 'https:'].includes(expected.protocol)) {
      return false;
    }

    return frame.href === expected.href;
  } catch {
    return false;
  }
}

export function getContentSecurityPolicy(development: boolean): string {
  const scripts = development ? "'self' 'unsafe-inline'" : "'self'";
  const connections = development
    ? "'self' ws://127.0.0.1:* ws://localhost:*"
    : "'none'";

  return [
    "default-src 'none'",
    'script-src ' + scripts,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    'connect-src ' + connections,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "form-action 'none'",
  ].join('; ');
}
