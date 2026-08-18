// No next/* imports — the unit test project has no Next stubs (vitest.config.ts).
export const DEFAULT_REDIRECT = '/positions';

const REDIRECT_BASE = 'https://redirect.invalid';

// Order matters: reject on the raw string before any parsing normalizes it.
export function sanitizeRedirectTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (/[\s\x00-\x1f]/.test(value)) return null;
  if (!value.startsWith('/')) return null;
  if (value[1] === '/' || value[1] === '\\') return null;

  let url: URL;
  try {
    url = new URL(value, REDIRECT_BASE);
  } catch {
    return null;
  }
  if (url.origin !== REDIRECT_BASE) return null;
  if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\'))
    return null;
  if (url.pathname === '/login' || url.pathname.startsWith('/login/'))
    return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeRedirectTo(
  value: unknown,
  fallback: string = DEFAULT_REDIRECT,
): string {
  return sanitizeRedirectTo(value) ?? fallback;
}

// Omits the param entirely when absent, unsanitary, or a self-reference.
export function withRedirectTo(
  base: string,
  path: string | null | undefined,
): string {
  const sanitized = sanitizeRedirectTo(path);
  if (!sanitized) return base;

  const basePathname = base.split(/[?#]/)[0];
  if (sanitized === basePathname) return base;

  return `${base}?redirectTo=${encodeURIComponent(sanitized)}`;
}
