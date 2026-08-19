import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REDIRECT,
  safeRedirectTo,
  sanitizeRedirectTo,
  withRedirectTo,
} from '@/lib/auth/redirect';

describe('sanitizeRedirectTo', () => {
  it('accepts a plain path', () => {
    expect(sanitizeRedirectTo('/my-applications')).toBe('/my-applications');
  });

  it('accepts a path with query and hash', () => {
    expect(sanitizeRedirectTo('/positions/1?tab=x#section')).toBe(
      '/positions/1?tab=x#section',
    );
  });

  it('rejects a protocol-relative URL', () => {
    expect(sanitizeRedirectTo('//evil.com')).toBeNull();
  });

  it('rejects a protocol-relative URL with a path', () => {
    expect(sanitizeRedirectTo('//evil.com/path')).toBeNull();
  });

  it('rejects a backslash-prefixed path', () => {
    expect(sanitizeRedirectTo('/\\evil.com')).toBeNull();
  });

  it('rejects a mixed slash-backslash path', () => {
    expect(sanitizeRedirectTo('/\\/evil.com')).toBeNull();
  });

  it('rejects an absolute URL', () => {
    expect(sanitizeRedirectTo('https://evil.com')).toBeNull();
  });

  it('rejects a javascript: URL', () => {
    expect(sanitizeRedirectTo('javascript:alert(1)')).toBeNull();
  });

  it('keeps an encoded double-slash same-origin, not off-origin', () => {
    const result = sanitizeRedirectTo('/%2F%2Fevil.com');
    expect(result).not.toBeNull();
    expect(result?.startsWith('/')).toBe(true);
    expect(result?.startsWith('//')).toBe(false);
  });

  it('keeps an encoded backslash same-origin, not off-origin', () => {
    const result = sanitizeRedirectTo('/%5Cevil.com');
    expect(result).not.toBeNull();
    expect(result?.startsWith('/')).toBe(true);
  });

  it('rejects a value containing a newline', () => {
    expect(sanitizeRedirectTo('/foo\n/evil.com')).toBeNull();
  });

  it('rejects a value containing a tab', () => {
    expect(sanitizeRedirectTo('/foo\t/evil.com')).toBeNull();
  });

  it('rejects a space-padded value', () => {
    expect(sanitizeRedirectTo(' /foo')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(sanitizeRedirectTo('')).toBeNull();
  });

  it('rejects null', () => {
    expect(sanitizeRedirectTo(null)).toBeNull();
  });

  it('rejects undefined', () => {
    expect(sanitizeRedirectTo(undefined)).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(sanitizeRedirectTo(42)).toBeNull();
  });

  it('rejects /login', () => {
    expect(sanitizeRedirectTo('/login')).toBeNull();
  });

  it('rejects /login with a query', () => {
    expect(sanitizeRedirectTo('/login?x=1')).toBeNull();
  });

  it('rejects /login/bypass', () => {
    expect(sanitizeRedirectTo('/login/bypass')).toBeNull();
  });

  it('rejects a traversal segment rather than normalizing it', () => {
    expect(sanitizeRedirectTo('/foo/../evil.com')).toBeNull();
  });

  it('rejects a traversal segment that would climb past the origin', () => {
    expect(sanitizeRedirectTo('/../evil.com')).toBeNull();
  });

  it('rejects a traversal segment in the query or hash', () => {
    expect(sanitizeRedirectTo('/foo?x=../evil')).not.toBeNull();
    expect(sanitizeRedirectTo('/foo#../evil')).not.toBeNull();
  });
});

describe('safeRedirectTo', () => {
  it('returns the sanitized value when valid', () => {
    expect(safeRedirectTo('/my-applications')).toBe('/my-applications');
  });

  it('falls back to the default when invalid', () => {
    expect(safeRedirectTo('//evil.com')).toBe(DEFAULT_REDIRECT);
  });

  it('supports a custom fallback', () => {
    expect(safeRedirectTo('//evil.com', '/')).toBe('/');
    expect(safeRedirectTo(undefined, '/')).toBe('/');
  });
});

describe('withRedirectTo', () => {
  it('attaches a sanitized destination', () => {
    expect(withRedirectTo('/login', '/my-applications')).toBe(
      '/login?redirectTo=%2Fmy-applications',
    );
  });

  it('omits the param when the path is absent', () => {
    expect(withRedirectTo('/login', undefined)).toBe('/login');
    expect(withRedirectTo('/login', null)).toBe('/login');
  });

  it('omits the param when sanitization rejects the path', () => {
    expect(withRedirectTo('/login', '//evil.com')).toBe('/login');
  });

  it('omits the param on self-reference', () => {
    expect(withRedirectTo('/login', '/login')).toBe('/login');
    expect(withRedirectTo('/profile', '/profile')).toBe('/profile');
  });
});
