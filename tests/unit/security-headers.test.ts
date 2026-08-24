import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from '@/lib/security-headers';

describe('buildContentSecurityPolicy', () => {
  it('includes the production directive set and omits dev relaxations', () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain(`default-src 'self'`);
    expect(csp).toContain(`base-uri 'self'`);
    expect(csp).toContain(`object-src 'none'`);
    expect(csp).toContain(`frame-ancestors 'none'`);
    expect(csp).toContain(`form-action 'self'`);
    expect(csp).toContain(`script-src 'self' 'unsafe-inline'`);
    expect(csp).toContain(`style-src 'self' 'unsafe-inline'`);
    expect(csp).toContain(`img-src 'self' data:`);
    expect(csp).toContain(`font-src 'self'`);
    expect(csp).toContain(`connect-src 'self'`);
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
  });

  it('relaxes script-src and connect-src, and drops upgrade-insecure-requests, in development', () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain(`script-src 'self' 'unsafe-inline' 'unsafe-eval'`);
    expect(csp).toContain(`connect-src 'self' ws: wss:`);
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});

describe('buildSecurityHeaders', () => {
  it('returns all six headers with their exact values in production', () => {
    const headers = buildSecurityHeaders(false);
    expect(headers).toEqual([
      {
        key: 'Content-Security-Policy',
        value: buildContentSecurityPolicy(false),
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]);
  });

  it('threads the development flag into the CSP header', () => {
    const headers = buildSecurityHeaders(true);
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toBe(buildContentSecurityPolicy(true));
  });
});
