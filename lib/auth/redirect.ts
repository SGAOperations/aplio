// No next/* imports — the unit test project has no Next stubs (vitest.config.ts).
export const DEFAULT_REDIRECT = '/';

// One leading slash, then nothing that could open an authority or split a header.
const SAFE_PATH = /^\/(?![/\\])[^\\\s\x00-\x1f]*$/;

export function sanitizeRedirectTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!SAFE_PATH.test(value)) return null;

  const pathname = value.split(/[?#]/)[0];
  // Rejected rather than normalized — no in-app destination needs traversal.
  if (pathname.split('/').includes('..')) return null;
  if (pathname === '/login' || pathname.startsWith('/login/')) return null;

  return value;
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
