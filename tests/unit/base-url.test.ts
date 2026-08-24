import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBaseUrl } from '@/lib/base-url';

describe('getBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers BETTER_AUTH_URL over VERCEL_URL', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://apply.northeasternsga.com');
    vi.stubEnv('VERCEL_URL', 'preview-123.vercel.app');
    expect(getBaseUrl()).toBe('https://apply.northeasternsga.com');
  });

  it('falls back to VERCEL_URL when BETTER_AUTH_URL is unset', () => {
    vi.stubEnv('BETTER_AUTH_URL', '');
    vi.stubEnv('VERCEL_URL', 'preview-123.vercel.app');
    expect(getBaseUrl()).toBe('https://preview-123.vercel.app');
  });

  it('falls back to localhost when neither is set', () => {
    vi.stubEnv('BETTER_AUTH_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });

  it('trims a trailing slash from BETTER_AUTH_URL', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://apply.northeasternsga.com/');
    expect(getBaseUrl()).toBe('https://apply.northeasternsga.com');
  });

  it('trims trailing slashes from the derived VERCEL_URL origin', () => {
    vi.stubEnv('BETTER_AUTH_URL', '');
    vi.stubEnv('VERCEL_URL', 'preview-123.vercel.app/');
    expect(getBaseUrl()).toBe('https://preview-123.vercel.app');
  });
});
