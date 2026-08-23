import { afterEach, describe, expect, it } from 'vitest';

import { MANAGED_POSITIONS_WINDOW_DAYS } from '@/lib/constants';
import type { AnswerQuestion, PositionActivity } from '@/lib/types';
import {
  answerFieldIds,
  formatAlternatives,
  formatTableCount,
  getPositionAvailability,
  getUserRoleRank,
  getUserRoleTokens,
  isAnswered,
  isBypassAllowed,
  isError,
  isPositionActive,
  partitionAnswerValue,
  splitOtherAnswer,
  summarizeBulkStatusChange,
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

  it('is closed_by_date once now passes closesAt', () => {
    const closesAt = new Date(NOW.getTime() - 1);
    expect(
      getPositionAvailability({ status: 'open', opensAt: null, closesAt }, NOW),
    ).toBe('closed_by_date');
  });

  it('is accepting at exactly closesAt (inclusive)', () => {
    const closesAt = new Date(NOW);
    expect(
      getPositionAvailability({ status: 'open', opensAt: null, closesAt }, NOW),
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

describe('answerFieldIds', () => {
  it('derives every id from the question id', () => {
    expect(answerFieldIds('q1')).toEqual({
      labelId: 'q1-label',
      inputId: 'q1-input',
      errorId: 'q1-error',
      noticeId: 'q1-mismatch',
      statusId: 'q1-status',
    });
  });
});

describe('splitOtherAnswer', () => {
  const options = { options: ['a', 'b'] };

  it('splits checked options from a trailing "Other" entry', () => {
    expect(splitOtherAnswer(options, ['a', 'freeform'])).toEqual({
      selectedOptions: ['a'],
      otherText: 'freeform',
    });
  });

  it('finds an entry not among the options as the "Other" text', () => {
    expect(splitOtherAnswer(options, ['b', 'typed'])).toEqual({
      selectedOptions: ['b'],
      otherText: 'typed',
    });
  });

  it('treats an option literally named "Other" as a normal option', () => {
    expect(splitOtherAnswer({ options: ['a', 'Other'] }, ['Other'])).toEqual({
      selectedOptions: ['Other'],
      otherText: '',
    });
  });

  it('returns an empty otherText when nothing orphans', () => {
    expect(splitOtherAnswer(options, ['a', 'b'])).toEqual({
      selectedOptions: ['a', 'b'],
      otherText: '',
    });
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

describe('summarizeBulkStatusChange', () => {
  it('has no skipped label when nothing is skipped', () => {
    expect(
      summarizeBulkStatusChange([
        { status: 'applied' },
        { status: 'reviewing' },
      ]),
    ).toEqual({ eligibleCount: 2, skippedCount: 0, skippedLabel: null });
  });

  it('names a single withdrawn row', () => {
    expect(
      summarizeBulkStatusChange([
        { status: 'applied' },
        { status: 'withdrawn' },
      ]),
    ).toEqual({
      eligibleCount: 1,
      skippedCount: 1,
      skippedLabel: '1 withdrawn application',
    });
  });

  it('handles every row being withdrawn', () => {
    expect(
      summarizeBulkStatusChange([
        { status: 'withdrawn' },
        { status: 'withdrawn' },
      ]),
    ).toEqual({
      eligibleCount: 0,
      skippedCount: 2,
      skippedLabel: '2 withdrawn applications',
    });
  });

  it('combines draft and withdrawn counts in NON_REVIEWABLE order', () => {
    expect(
      summarizeBulkStatusChange([
        { status: 'withdrawn' },
        { status: 'draft' },
        { status: 'applied' },
      ]),
    ).toEqual({
      eligibleCount: 1,
      skippedCount: 2,
      skippedLabel: '1 draft application and 1 withdrawn application',
    });
  });
});

describe('formatAlternatives', () => {
  it('returns a single label as-is', () => {
    expect(formatAlternatives(['Reviewing'])).toBe('Reviewing');
  });

  it('joins two labels with "or"', () => {
    expect(formatAlternatives(['Reached out', 'Reviewing'])).toBe(
      'Reached out or Reviewing',
    );
  });

  it('joins three or more labels with a comma list and a trailing "or"', () => {
    expect(formatAlternatives(['Applied', 'Reached out', 'Reviewing'])).toBe(
      'Applied, Reached out, or Reviewing',
    );
  });

  it('returns an empty string for no labels', () => {
    expect(formatAlternatives([])).toBe('');
  });
});

describe('getUserRoleTokens', () => {
  it('returns admin for an admin who manages nothing', () => {
    expect(getUserRoleTokens({ isAdmin: true, managedPositions: [] })).toEqual([
      'admin',
    ]);
  });

  it('returns manager for a non-admin who manages a position', () => {
    expect(
      getUserRoleTokens({ isAdmin: false, managedPositions: [{ id: 'p1' }] }),
    ).toEqual(['manager']);
  });

  it('returns both, admin first, for an admin who also manages a position', () => {
    expect(
      getUserRoleTokens({ isAdmin: true, managedPositions: [{ id: 'p1' }] }),
    ).toEqual(['admin', 'manager']);
  });

  it('returns no tokens for neither', () => {
    expect(getUserRoleTokens({ isAdmin: false, managedPositions: [] })).toEqual(
      [],
    );
  });
});

describe('getUserRoleRank', () => {
  it('ranks admin 0', () => {
    expect(getUserRoleRank({ isAdmin: true, managedPositions: [] })).toBe(0);
  });

  it('ranks manager 1', () => {
    expect(
      getUserRoleRank({ isAdmin: false, managedPositions: [{ id: 'p1' }] }),
    ).toBe(1);
  });

  it('ranks an admin who also manages by the higher (admin) rank', () => {
    expect(
      getUserRoleRank({ isAdmin: true, managedPositions: [{ id: 'p1' }] }),
    ).toBe(0);
  });

  it('ranks neither last', () => {
    expect(getUserRoleRank({ isAdmin: false, managedPositions: [] })).toBe(2);
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
