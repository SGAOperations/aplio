import { describe, expect, it } from 'vitest';

import {
  bucketAgingDays,
  bucketize,
  classifyChoiceValue,
  classifyTransition,
  fillSeries,
  formatDuration,
  mean,
  median,
  meetsSample,
  percent,
  percentile,
  resolveInsightsRange,
} from '@/lib/insights';

describe('median', () => {
  it('averages the two middle values for an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns the middle value for an odd-length list', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('returns null for an empty list', () => {
    expect(median([])).toBeNull();
  });
});

describe('mean', () => {
  it('averages a list', () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it('returns null for an empty list', () => {
    expect(mean([])).toBeNull();
  });
});

describe('percentile', () => {
  it('returns the exact value for p95 on a 100-value run', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(95);
  });

  it('returns null for an empty list', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('returns the single value for a one-element list', () => {
    expect(percentile([7], 0.95)).toBe(7);
  });
});

describe('percent', () => {
  it('rounds to the nearest integer', () => {
    expect(percent(1, 3)).toBe(33);
  });

  it('returns null for a zero denominator', () => {
    expect(percent(0, 0)).toBeNull();
  });
});

describe('bucketize', () => {
  it('places values at the boundary in the lower-edge bucket', () => {
    const result = bucketize([0, 1, 2, 3], [1, 3], ['a', 'b', 'c']);
    expect(result).toEqual([
      { label: 'a', count: 1 },
      { label: 'b', count: 2 },
      { label: 'c', count: 1 },
    ]);
  });

  it('returns zero counts for an empty input', () => {
    expect(bucketize([], [1, 3], ['a', 'b', 'c'])).toEqual([
      { label: 'a', count: 0 },
      { label: 'b', count: 0 },
      { label: 'c', count: 0 },
    ]);
  });
});

describe('bucketAgingDays', () => {
  it('buckets the documented edges', () => {
    const result = bucketAgingDays([0, 5, 10, 20, 40]);
    expect(result.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('resolveInsightsRange', () => {
  const now = new Date('2026-09-28T15:00:00Z');

  it('30d spans today + 29 days back', () => {
    const range = resolveInsightsRange(
      { range: '30d', from: null, to: null },
      now,
    );
    expect(range.fromDay).toBe('2026-08-30');
    expect(range.toDay).toBe('2026-09-28');
    expect(range.granularity).toBe('day');
  });

  it('12mo spans 365 days and switches to week granularity', () => {
    const range = resolveInsightsRange(
      { range: '12mo', from: null, to: null },
      now,
    );
    expect(range.fromDay).toBe('2025-09-29');
    expect(range.granularity).toBe('week');
  });

  it('all has a null start and week granularity', () => {
    const range = resolveInsightsRange(
      { range: 'all', from: null, to: null },
      now,
    );
    expect(range.start).toBeNull();
    expect(range.fromDay).toBeNull();
    expect(range.granularity).toBe('week');
  });

  it('accepts a valid custom range', () => {
    const range = resolveInsightsRange(
      { range: 'custom', from: '2026-01-01', to: '2026-01-31' },
      now,
    );
    expect(range).toMatchObject({
      preset: 'custom',
      fromDay: '2026-01-01',
      toDay: '2026-01-31',
    });
  });

  it('clamps a future `to` to today', () => {
    const range = resolveInsightsRange(
      { range: 'custom', from: '2026-09-01', to: '2099-01-01' },
      now,
    );
    expect(range.toDay).toBe('2026-09-28');
  });

  it('falls back to the default range when from > to', () => {
    const range = resolveInsightsRange(
      { range: 'custom', from: '2026-09-28', to: '2026-01-01' },
      now,
    );
    expect(range.preset).toBe('90d');
  });

  it('falls back to the default range when from/to are missing', () => {
    const range = resolveInsightsRange(
      { range: 'custom', from: null, to: null },
      now,
    );
    expect(range.preset).toBe('90d');
  });

  it('resolves org-local bounds across the November DST change', () => {
    const acrossFallBack = new Date('2026-11-05T12:00:00Z');
    const range = resolveInsightsRange(
      { range: '30d', from: null, to: null },
      acrossFallBack,
    );
    expect(range.start?.toISOString()).toBe('2026-10-07T04:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-06T04:59:59.999Z');
  });

  it('switches to week granularity only past INSIGHTS_DAILY_MAX_DAYS', () => {
    const under = resolveInsightsRange(
      { range: 'custom', from: '2026-01-01', to: '2026-03-31' },
      now,
    );
    expect(under.granularity).toBe('day');

    const over = resolveInsightsRange(
      { range: 'custom', from: '2026-01-01', to: '2026-06-01' },
      now,
    );
    expect(over.granularity).toBe('week');
  });
});

describe('fillSeries', () => {
  it('zero-fills every day in a day-granularity range', () => {
    const range = {
      fromDay: '2026-01-01',
      toDay: '2026-01-03',
      granularity: 'day' as const,
    };
    const result = fillSeries(new Map([['2026-01-02', 5]]), range);
    expect(result).toEqual([
      { day: '2026-01-01', count: 0 },
      { day: '2026-01-02', count: 5 },
      { day: '2026-01-03', count: 0 },
    ]);
  });

  it('zero-fills every Monday in a week-granularity range', () => {
    const range = {
      fromDay: '2026-01-05',
      toDay: '2026-01-19',
      granularity: 'week' as const,
    };
    const result = fillSeries(new Map([['2026-01-12', 3]]), range);
    expect(result.map((p) => p.day)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
    ]);
    expect(result.map((p) => p.count)).toEqual([0, 3, 0]);
  });

  it('returns only populated days, sorted, when fromDay is null (all time)', () => {
    const range = {
      fromDay: null,
      toDay: '2026-01-19',
      granularity: 'week' as const,
    };
    const result = fillSeries(
      new Map([
        ['2026-01-12', 3],
        ['2026-01-01', 1],
      ]),
      range,
    );
    expect(result).toEqual([
      { day: '2026-01-01', count: 1 },
      { day: '2026-01-12', count: 3 },
    ]);
  });
});

describe('classifyTransition', () => {
  it('classifies a forward move', () => {
    expect(classifyTransition('applied', 'reached_out')).toBe('forward');
  });

  it('classifies a backward move', () => {
    expect(classifyTransition('reviewing', 'applied')).toBe('backward');
  });

  it('classifies an accepted <-> rejected flip in both directions', () => {
    expect(classifyTransition('accepted', 'rejected')).toBe('flip');
    expect(classifyTransition('rejected', 'accepted')).toBe('flip');
  });

  it('classifies anything touching draft or withdrawn as off-path', () => {
    expect(classifyTransition('draft', 'applied')).toBe('offPath');
    expect(classifyTransition('applied', 'withdrawn')).toBe('offPath');
  });
});

describe('classifyChoiceValue', () => {
  it('classifies a current option', () => {
    expect(classifyChoiceValue('Red', ['Red', 'Blue'], true)).toBe('option');
  });

  it('classifies a non-option as other when allowed', () => {
    expect(classifyChoiceValue('Green', ['Red', 'Blue'], true)).toBe('other');
  });

  it('classifies a non-option as retired when Other is not allowed', () => {
    expect(classifyChoiceValue('Green', ['Red', 'Blue'], false)).toBe(
      'retired',
    );
  });
});

describe('meetsSample', () => {
  it('is false below INSIGHTS_MIN_SAMPLE and true at/above it', () => {
    expect(meetsSample(4)).toBe(false);
    expect(meetsSample(5)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats under a day in hours', () => {
    expect(formatDuration(5)).toBe('5 hours');
    expect(formatDuration(1)).toBe('1 hour');
  });

  it('formats a day or more in days, to one decimal', () => {
    expect(formatDuration(24 * 3.2)).toBe('3.2 days');
  });
});
