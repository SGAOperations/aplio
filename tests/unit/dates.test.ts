import { describe, expect, it } from 'vitest';

import {
  formatInstant,
  formatRelativeTime,
  orgDayEnd,
  orgDayStart,
  toOrgDayString,
} from '@/lib/dates';

describe('orgDayStart', () => {
  it('resolves a summer day to EDT (UTC-4)', () => {
    expect(orgDayStart('2026-06-30').toISOString()).toBe(
      '2026-06-30T04:00:00.000Z',
    );
  });

  it('resolves a winter day to EST (UTC-5)', () => {
    expect(orgDayStart('2026-01-15').toISOString()).toBe(
      '2026-01-15T05:00:00.000Z',
    );
  });

  it('resolves the spring-forward transition day to EST (before the 2am jump)', () => {
    expect(orgDayStart('2026-03-08').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
  });

  it('resolves the fall-back transition day to EDT (before the 2am jump)', () => {
    expect(orgDayStart('2026-11-01').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });
});

describe('orgDayEnd', () => {
  it('resolves a summer day to EDT (UTC-4)', () => {
    expect(orgDayEnd('2026-06-30').toISOString()).toBe(
      '2026-07-01T03:59:59.999Z',
    );
  });

  it('resolves a winter day to EST (UTC-5)', () => {
    expect(orgDayEnd('2026-01-15').toISOString()).toBe(
      '2026-01-16T04:59:59.999Z',
    );
  });

  it('resolves the spring-forward transition day to EDT (after the 2am jump)', () => {
    expect(orgDayEnd('2026-03-08').toISOString()).toBe(
      '2026-03-09T03:59:59.999Z',
    );
  });

  it('resolves the fall-back transition day to EST (after the 2am jump)', () => {
    expect(orgDayEnd('2026-11-01').toISOString()).toBe(
      '2026-11-02T04:59:59.999Z',
    );
  });
});

describe('toOrgDayString', () => {
  it('recovers the authored day from an EDT instant', () => {
    expect(toOrgDayString(orgDayEnd('2026-06-30'))).toBe('2026-06-30');
  });

  it('recovers the authored day from an EST instant', () => {
    expect(toOrgDayString(orgDayEnd('2026-01-15'))).toBe('2026-01-15');
  });

  it('round-trips through orgDayEnd for every DST case', () => {
    for (const day of [
      '2026-06-30',
      '2026-01-15',
      '2026-03-08',
      '2026-11-01',
    ]) {
      const end = orgDayEnd(day);
      expect(orgDayEnd(toOrgDayString(end))).toEqual(end);
    }
  });
});

describe('formatInstant', () => {
  const date = new Date('2026-06-30T23:30:00.000Z');

  it('formats a bare date', () => {
    expect(
      formatInstant(date, { precision: 'date', timeZone: 'America/New_York' }),
    ).toBe('Jun 30, 2026');
  });

  it('formats a datetime with the zone abbreviation', () => {
    expect(
      formatInstant(date, {
        precision: 'datetime',
        timeZone: 'America/New_York',
      }),
    ).toBe('Jun 30, 2026, 7:30 PM EDT');
  });

  it('reads the next calendar day in a later zone', () => {
    expect(
      formatInstant(date, { precision: 'datetime', timeZone: 'Europe/London' }),
    ).toBe('Jul 1, 2026, 12:30 AM GMT+1');
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-08-15T12:00:00Z');

  it('returns "Just now" for under a minute', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 30 * 1000), NOW)).toBe(
      'Just now',
    );
  });

  it('formats minutes', () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 5 * 60 * 1000), NOW),
    ).toBe('5m ago');
  });

  it('formats hours', () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 3 * 60 * 60 * 1000), NOW),
    ).toBe('3h ago');
  });

  it('formats days', () => {
    expect(
      formatRelativeTime(
        new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        NOW,
      ),
    ).toBe('2d ago');
  });

  it('falls back to an absolute date at exactly 7 days', () => {
    const date = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe(
      formatInstant(date, { precision: 'date', timeZone: 'America/New_York' }),
    );
  });
});
