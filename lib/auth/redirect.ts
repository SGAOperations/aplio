// No next/* imports — the unit test project has no Next stubs (vitest.config.ts).
export const DEFAULT_REDIRECT = '/';

// One leading slash, then nothing that could open an authority or split a header.
const SAFE_PATH = /^\/(?![/\\])[^\\\s\x00-\x1f]*$/;

// Next appends these to client-side navigation requests; they're never a
// destination the user asked for and must not leak into the address bar.
function stripNextInternalParams(value: string): string {
  const hashIndex = value.indexOf('#');
  const hash = hashIndex === -1 ? '' : value.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);

  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex === -1) return value;

  const pathname = beforeHash.slice(0, queryIndex);
  const params = new URLSearchParams(beforeHash.slice(queryIndex + 1));
  for (const key of [...params.keys()])
    if (key === '_rsc' || key.startsWith('_next')) params.delete(key);

  const query = params.toString();
  return pathname + (query ? `?${query}` : '') + hash;
}

export function sanitizeRedirectTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!SAFE_PATH.test(value)) return null;

  const pathname = value.split(/[?#]/)[0] ?? value;
  // Rejected rather than normalized — no in-app destination needs traversal.
  if (pathname.split('/').includes('..')) return null;
  if (pathname === '/login' || pathname.startsWith('/login/')) return null;

  return stripNextInternalParams(value);
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
