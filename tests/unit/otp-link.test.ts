import { describe, expect, it } from 'vitest';

import {
  buildOtpSignInUrl,
  parseOtpLinkParams,
  strippedOtpLinkHref,
} from '@/lib/auth/otp-link';

describe('buildOtpSignInUrl / parseOtpLinkParams round-trip', () => {
  it('parses back the values it built', () => {
    const url = buildOtpSignInUrl(
      'https://apply.northeasternsga.com',
      'person+test@example.com',
      '123456',
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://apply.northeasternsga.com/login',
    );

    const result = parseOtpLinkParams({
      email: parsed.searchParams.get('email') ?? undefined,
      otp: parsed.searchParams.get('otp') ?? undefined,
    });
    expect(result).toEqual({ email: 'person+test@example.com', otp: '123456' });
  });
});

describe('parseOtpLinkParams', () => {
  it('rejects a bad email', () => {
    expect(
      parseOtpLinkParams({ email: 'not-an-email', otp: '123456' }),
    ).toBeNull();
  });

  it('rejects a 5-digit otp', () => {
    expect(
      parseOtpLinkParams({ email: 'a@example.com', otp: '12345' }),
    ).toBeNull();
  });

  it('rejects a non-numeric otp', () => {
    expect(
      parseOtpLinkParams({ email: 'a@example.com', otp: 'abcdef' }),
    ).toBeNull();
  });

  it('rejects missing params', () => {
    expect(parseOtpLinkParams({})).toBeNull();
    expect(parseOtpLinkParams({ email: 'a@example.com' })).toBeNull();
    expect(parseOtpLinkParams({ otp: '123456' })).toBeNull();
  });
});

describe('strippedOtpLinkHref', () => {
  it('removes email and otp but preserves other params and the hash', () => {
    const href =
      'https://apply.northeasternsga.com/login?email=a%40example.com&otp=123456&redirectTo=%2Fpositions#section';
    const result = strippedOtpLinkHref(href);
    const url = new URL(result);
    expect(url.searchParams.has('email')).toBe(false);
    expect(url.searchParams.has('otp')).toBe(false);
    expect(url.searchParams.get('redirectTo')).toBe('/positions');
    expect(url.hash).toBe('#section');
  });
});
