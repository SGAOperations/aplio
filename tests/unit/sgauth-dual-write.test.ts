import { describe, expect, it, vi } from 'vitest';

import {
  classifyDualWriteStatus,
  readDualWriteConfig,
} from '@/lib/auth/sgauth-dual-write';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

describe('readDualWriteConfig', () => {
  const full = {
    SGAUTH_URL: 'https://auth-dev.northeasternsga.com/',
    APLIO_DUAL_WRITE_SECRET: 'secret',
    APLIO_READ_CUTOVER_AT: '2026-12-01T05:00:00-05:00',
  };

  it('is off when any variable is unset', () => {
    expect(readDualWriteConfig({})).toBeNull();
    expect(
      readDualWriteConfig({ ...full, APLIO_DUAL_WRITE_SECRET: '' }),
    ).toBeNull();
    expect(
      readDualWriteConfig({ ...full, APLIO_READ_CUTOVER_AT: undefined }),
    ).toBeNull();
  });

  it('parses the cutover offset and trims the trailing slash', () => {
    const config = readDualWriteConfig(full);
    expect(config?.url).toBe('https://auth-dev.northeasternsga.com');
    expect(config?.cutoverAt.toISOString()).toBe('2026-12-01T10:00:00.000Z');
  });

  it('throws on an unparseable cutover', () => {
    expect(() =>
      readDualWriteConfig({ ...full, APLIO_READ_CUTOVER_AT: 'soon' }),
    ).toThrow();
  });
});

describe('classifyDualWriteStatus', () => {
  it('stores on 200', () => {
    expect(classifyDualWriteStatus(200)).toBe('store');
  });

  it('retries on 5xx', () => {
    expect(classifyDualWriteStatus(500)).toBe('retry');
    expect(classifyDualWriteStatus(503)).toBe('retry');
  });

  it('stops on final and configuration statuses', () => {
    for (const status of [400, 401, 404, 409, 410])
      expect(classifyDualWriteStatus(status)).toBe('stop');
  });
});
