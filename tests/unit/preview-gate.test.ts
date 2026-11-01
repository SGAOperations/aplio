import { describe, expect, it } from 'vitest';

import {
  GATE_MAX_AGE_SECONDS,
  createAttemptLimiter,
  isExemptPath,
  isGatePath,
  passwordMatches,
  readGateConfig,
  safeNextPath,
  signGateCookie,
  verifyGateCookie,
} from '@/lib/preview-gate';

const NOW = 1_800_000_000;

describe('readGateConfig', () => {
  it('is off outside preview deployments', () => {
    expect(readGateConfig({})).toEqual({ mode: 'off' });
    expect(
      readGateConfig({
        VERCEL_ENV: 'production',
        APLIO_PREVIEW_GATE_PASSWORD: 'pw',
      }),
    ).toEqual({ mode: 'off' });
    expect(readGateConfig({ VERCEL_ENV: 'development' })).toEqual({
      mode: 'off',
    });
  });

  it('is on for a preview with a password', () => {
    expect(
      readGateConfig({
        VERCEL_ENV: 'preview',
        APLIO_PREVIEW_GATE_PASSWORD: 'pw',
      }),
    ).toEqual({ mode: 'on', password: 'pw' });
  });

  it('fails closed for a preview without a password', () => {
    expect(readGateConfig({ VERCEL_ENV: 'preview' })).toEqual({
      mode: 'misconfigured',
    });
  });

  it('can be turned off explicitly on a preview', () => {
    expect(
      readGateConfig({ VERCEL_ENV: 'preview', APLIO_PREVIEW_GATE: 'off' }),
    ).toEqual({ mode: 'off' });
  });
});

describe('route matchers', () => {
  it('exempts only the exact machine endpoints', () => {
    expect(isExemptPath('/api/webhooks/resend')).toBe(true);
    expect(isExemptPath('/api/cron/manager-daily-digest/')).toBe(true);
    expect(isExemptPath('/api/webhooks/resend/extra')).toBe(false);
    expect(isExemptPath('/positions')).toBe(false);
  });

  it('recognises the gate page', () => {
    expect(isGatePath('/preview-gate')).toBe(true);
    expect(isGatePath('/preview-gate/')).toBe(true);
    expect(isGatePath('/preview-gate-x')).toBe(false);
  });
});

describe('gate cookie', () => {
  it('verifies a cookie it signed', async () => {
    const value = await signGateCookie('pw', NOW);
    expect(await verifyGateCookie('pw', value, NOW + 60)).toBe(true);
  });

  it('rejects a cookie after the password rotates', async () => {
    const value = await signGateCookie('old', NOW);
    expect(await verifyGateCookie('new', value, NOW)).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    const value = await signGateCookie('pw', NOW);
    expect(
      await verifyGateCookie('pw', value, NOW + GATE_MAX_AGE_SECONDS + 1),
    ).toBe(false);
  });

  it('rejects a tampered expiry and malformed values', async () => {
    const value = await signGateCookie('pw', NOW);
    const [, mac] = value.split('.');
    expect(
      await verifyGateCookie(
        'pw',
        `${NOW + GATE_MAX_AGE_SECONDS - 5}.${mac}`,
        NOW,
      ),
    ).toBe(false);
    for (const bad of [undefined, '', 'abc', '1.2.3', `0.${mac}`])
      expect(await verifyGateCookie('pw', bad, NOW)).toBe(false);
  });

  it('rejects an expiry far in the future', async () => {
    const value = await signGateCookie('pw', NOW + 10 * GATE_MAX_AGE_SECONDS);
    expect(await verifyGateCookie('pw', value, NOW)).toBe(false);
  });
});

describe('passwordMatches', () => {
  it('matches only the exact password', async () => {
    expect(await passwordMatches('correct horse', 'correct horse')).toBe(true);
    expect(await passwordMatches('correct horsE', 'correct horse')).toBe(false);
    expect(await passwordMatches('', 'correct horse')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps a same-site path with its query', () => {
    expect(safeNextPath('/positions?q=vp')).toBe('/positions?q=vp');
  });

  it('falls back to / for anything off-site or looping', () => {
    for (const bad of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'positions',
      '/preview-gate?next=/x',
      '/a\nb',
      42,
    ])
      expect(safeNextPath(bad)).toBe('/');
  });
});

describe('createAttemptLimiter', () => {
  it('allows up to the limit per window, then resets', () => {
    const limiter = createAttemptLimiter({
      limit: 2,
      windowMs: 1000,
      maxKeys: 10,
    });
    expect(limiter.hit('ip', 0)).toBe(true);
    expect(limiter.hit('ip', 1)).toBe(true);
    expect(limiter.hit('ip', 2)).toBe(false);
    expect(limiter.hit('other', 2)).toBe(true);
    expect(limiter.hit('ip', 1001)).toBe(true);
  });
});
