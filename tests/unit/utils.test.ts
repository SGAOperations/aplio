import { afterEach, describe, expect, it } from 'vitest';

import { MANAGED_POSITIONS_WINDOW_DAYS } from '@/lib/constants';
import type { AnswerQuestion, PositionActivity } from '@/lib/types';
import {
  formatDate,
  formatRelativeTime,
  formatTableCount,
  getPositionAvailability,
  isAnswered,
  isBypassAllowed,
  isError,
  isPositionActive,
  partitionAnswerValue,
} from '@/lib/utils';

// Fixed, mid-August — clear of the March/November DST transitions.
const NOW = new Date('2026-08-15T12:00:00Z');

describe('getPositionAvailability', () => {
  it('is unavailable when draft', () => {
    expect(
      getPositionAvailability(
        { status: 'draft', opensAt: null, closesAt: null },
        NOW,
      ),
    ).toBe('unavailable');
  });

  it('is unavailable when closed', () => {
    expect(
      getPositionAvailability(
        { status: 'closed', opensAt: null, closesAt: null },
        NOW,
      ),
    ).toBe('unavailable');
  });

  it('is upcoming when opensAt is in the future', () => {
    const opensAt = new Date(NOW);
    opensAt.setDate(opensAt.getDate() + 5);
    expect(
      getPositionAvailability({ status: 'open', opensAt, closesAt: null }, NOW),
    ).toBe('upcoming');
  });

  it('is accepting when open with null opensAt/closesAt', () => {
    expect(
      getPositionAvailability(
        { status: 'open', opensAt: null, closesAt: null },
        NOW,
      ),
    ).toBe('accepting');
  });
});

describe('isPositionActive', () => {
  it('is active when open', () => {
    const position: PositionActivity = {
      status: 'open',
      opensAt: null,
      closesAt: null,
      updatedAt: NOW,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is active when closed with unresolved applications', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - 10);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      _count: { applications: 3 },
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is active when closed, zero applications, inside the recency window', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - 10);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is archived when closed, zero applications, outside the recency window', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });

  it('is active exactly at the recency window boundary (inclusive)', () => {
    const cutoff = new Date(NOW);
    cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt: cutoff,
      updatedAt: cutoff,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('falls back to updatedAt when closesAt is null', () => {
    const recentUpdatedAt = new Date(NOW);
    recentUpdatedAt.setDate(recentUpdatedAt.getDate() - 10);
    const activePosition: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt: null,
      updatedAt: recentUpdatedAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(activePosition, NOW)).toBe(true);

    const staleUpdatedAt = new Date(NOW);
    staleUpdatedAt.setDate(
      staleUpdatedAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10),
    );
    const archivedPosition: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt: null,
      updatedAt: staleUpdatedAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(archivedPosition, NOW)).toBe(false);
  });

  it('treats an open position past closesAt as closed', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const position: PositionActivity = {
      status: 'open',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });

  it('never counts a draft-only application as unresolved (#340)', () => {
    // _count.applications must already exclude 'draft' — a draft-only
    // position closed outside the window still archives.
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      _count: { applications: 0 },
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for under a minute', () => {
    const date = new Date(NOW.getTime() - 30 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe('Just now');
  });

  it('formats minutes', () => {
    const date = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe('5m ago');
  });

  it('formats hours', () => {
    const date = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe('3h ago');
  });

  it('formats days', () => {
    const date = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe('2d ago');
  });

  it('falls back to formatDate at exactly 7 days', () => {
    const date = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe(formatDate(date));
  });
});

describe('formatTableCount', () => {
  it('shows a bare count when nothing is hidden', () => {
    expect(formatTableCount({ shown: 5, total: 5, noun: 'application' })).toBe(
      '5 applications',
    );
  });

  it('uses the singular noun for a total of one', () => {
    expect(formatTableCount({ shown: 1, total: 1, noun: 'application' })).toBe(
      '1 application',
    );
  });

  it('shows "shown / total" when filtered', () => {
    expect(
      formatTableCount({
        shown: 3,
        total: 10,
        noun: 'application',
        isFiltered: true,
      }),
    ).toBe('3 / 10 applications');
  });

  it('shows "100+" when the shown count is capped', () => {
    expect(
      formatTableCount({
        shown: 100,
        total: 250,
        noun: 'application',
        shownCapped: true,
      }),
    ).toBe('100+ / 250 applications');
  });

  it('supports an irregular plural noun', () => {
    expect(
      formatTableCount({
        shown: 2,
        total: 2,
        noun: 'query',
        pluralNoun: 'queries',
      }),
    ).toBe('2 queries');
  });
});

const shortAnswerQuestion: AnswerQuestion = {
  id: 'q1',
  label: 'Q',
  type: 'short_answer',
  required: true,
  options: [],
  allowOther: false,
  format: null,
};

const singleChoiceQuestion: AnswerQuestion = {
  id: 'q2',
  label: 'Q',
  type: 'single_choice',
  required: true,
  options: ['a', 'b'],
  allowOther: false,
  format: null,
};

const singleChoiceOtherQuestion: AnswerQuestion = {
  ...singleChoiceQuestion,
  allowOther: true,
};

const multipleChoiceQuestion: AnswerQuestion = {
  id: 'q3',
  label: 'Q',
  type: 'multiple_choice',
  required: true,
  options: ['a', 'b'],
  allowOther: false,
  format: null,
};

const multipleChoiceOtherQuestion: AnswerQuestion = {
  ...multipleChoiceQuestion,
  allowOther: true,
};

describe('partitionAnswerValue', () => {
  it('splits a single-value question at index 1', () => {
    expect(partitionAnswerValue(shortAnswerQuestion, ['hi', 'stray'])).toEqual({
      fitted: ['hi'],
      orphaned: ['stray'],
    });
  });

  it('single_choice without allowOther orphans a non-option value', () => {
    expect(partitionAnswerValue(singleChoiceQuestion, ['c'])).toEqual({
      fitted: [],
      orphaned: ['c'],
    });
  });

  it('single_choice without allowOther fits a current option', () => {
    expect(partitionAnswerValue(singleChoiceQuestion, ['a'])).toEqual({
      fitted: ['a'],
      orphaned: [],
    });
  });

  it('single_choice with allowOther treats entry 0 as fitted regardless', () => {
    expect(
      partitionAnswerValue(singleChoiceOtherQuestion, ['freeform']),
    ).toEqual({ fitted: ['freeform'], orphaned: [] });
  });

  it('multiple_choice without allowOther keeps only current options', () => {
    expect(partitionAnswerValue(multipleChoiceQuestion, ['a', 'c'])).toEqual({
      fitted: ['a'],
      orphaned: ['c'],
    });
  });

  it('multiple_choice with allowOther fits options plus one "Other" entry', () => {
    expect(
      partitionAnswerValue(multipleChoiceOtherQuestion, [
        'a',
        'other1',
        'other2',
      ]),
    ).toEqual({ fitted: ['a', 'other1'], orphaned: ['other2'] });
  });
});

describe('isAnswered', () => {
  it('is true when the fitted part is non-empty', () => {
    expect(isAnswered(shortAnswerQuestion, ['hi'])).toBe(true);
  });

  it('is false when everything orphans', () => {
    expect(isAnswered(singleChoiceQuestion, ['c'])).toBe(false);
  });

  it('is false for an empty value', () => {
    expect(isAnswered(shortAnswerQuestion, [])).toBe(false);
  });
});

describe('isError', () => {
  it('is true for a result with an error key', () => {
    expect(isError({ error: 'oops' })).toBe(true);
  });

  it('is false for a plain value', () => {
    expect(isError('ok')).toBe(false);
  });

  it('is false for null and undefined', () => {
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });
});

describe('isBypassAllowed', () => {
  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  it('defaults to deny when VERCEL_ENV is unset', () => {
    delete process.env.VERCEL_ENV;
    expect(isBypassAllowed()).toBe(false);
  });

  it('allows development', () => {
    process.env.VERCEL_ENV = 'development';
    expect(isBypassAllowed()).toBe(true);
  });

  it('allows preview', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isBypassAllowed()).toBe(true);
  });

  it('denies production', () => {
    process.env.VERCEL_ENV = 'production';
    expect(isBypassAllowed()).toBe(false);
  });
});
