import { afterEach, describe, expect, it, vi } from 'vitest';

import { isSgauthCutoverPassed } from '@/lib/auth/sgauth-cutover';

describe('isSgauthCutoverPassed', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('is false when the cutover is unset', () => {
    vi.stubEnv('APLIO_READ_CUTOVER_AT', '');
    expect(isSgauthCutoverPassed()).toBe(false);
  });

  it('is false before the cutover and true at and after it', () => {
    vi.stubEnv('APLIO_READ_CUTOVER_AT', '2026-11-02T00:30:00-05:00');
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-11-02T05:29:59Z'));
    expect(isSgauthCutoverPassed()).toBe(false);

    vi.setSystemTime(new Date('2026-11-02T05:30:00Z'));
    expect(isSgauthCutoverPassed()).toBe(true);
  });

  it('throws on a value that is not an ISO 8601 time', () => {
    vi.stubEnv('APLIO_READ_CUTOVER_AT', 'soon');
    expect(() => isSgauthCutoverPassed()).toThrow(
      'APLIO_READ_CUTOVER_AT is not a valid ISO 8601 time',
    );
  });
});
