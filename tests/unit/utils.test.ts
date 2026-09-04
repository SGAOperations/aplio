import { afterEach, describe, expect, it } from 'vitest';

import {
  MANAGED_POSITIONS_WINDOW_DAYS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/constants';
import type { AnswerQuestion, PositionActivity } from '@/lib/types';
import {
  answerFieldIds,
  canReviewPosition,
  displayUserName,
  findDivergingGlobalAnswers,
  formatAlternatives,
  formatCountdown,
  formatPaginationSummary,
  formatTableCount,
  getApplicantName,
  getPaginationRange,
  getPositionAvailability,
  getUserName,
  getUserRoleRank,
  getUserRoleTokens,
  isAnswered,
  isBypassAllowed,
  isError,
  isPositionActive,
  isSameIdSet,
  partitionAnswerValue,
  resolveGlobalAnswerValues,
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
  it('is active when open, regardless of activity', () => {
    const position: PositionActivity = {
      status: 'open',
      opensAt: null,
      closesAt: null,
      updatedAt: NOW,
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is active when closed 10 days ago, regardless of activity', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - 10);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is active when closed long ago with a recent status change', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const lastStatusChangeAt = new Date(NOW);
    lastStatusChangeAt.setDate(lastStatusChangeAt.getDate() - 7);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt,
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is archived when closed long ago with stale activity and an unresolved application', () => {
    // The forgotten-applicant case (#581): an application sitting unresolved
    // no longer grants immunity once nothing has changed in over 30 days.
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const lastStatusChangeAt = new Date(NOW);
    lastStatusChangeAt.setDate(
      lastStatusChangeAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 5),
    );
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt,
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });

  it('is archived when closed long ago and fully resolved', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });

  it('is active exactly at the closed-for window boundary (inclusive)', () => {
    const cutoff = new Date(NOW);
    cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt: cutoff,
      updatedAt: cutoff,
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(true);
  });

  it('is active exactly at the idle-for window boundary (inclusive)', () => {
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const cutoff = new Date(NOW);
    cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt: cutoff,
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
      lastStatusChangeAt: null,
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
      lastStatusChangeAt: null,
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
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });

  it('a lingering draft never counts as activity', () => {
    // lastStatusChangeAt is only ever populated from a counted status event
    // (never a draft's absence of one), so a draft-only position closed
    // outside the window still archives.
    const closesAt = new Date(NOW);
    closesAt.setDate(closesAt.getDate() - (MANAGED_POSITIONS_WINDOW_DAYS + 10));
    const position: PositionActivity = {
      status: 'closed',
      opensAt: null,
      closesAt,
      updatedAt: closesAt,
      lastStatusChangeAt: null,
    };
    expect(isPositionActive(position, NOW)).toBe(false);
  });
});

describe('canReviewPosition', () => {
  it('lets an admin through regardless of the manager list', () => {
    expect(canReviewPosition({ id: 'admin-1', isAdmin: true }, [])).toBe(true);
  });

  it('lets a manager through when their id is in the list', () => {
    expect(
      canReviewPosition({ id: 'mgr-1', isAdmin: false }, ['mgr-1', 'mgr-2']),
    ).toBe(true);
  });

  it('denies a manager whose id is not in the list', () => {
    expect(
      canReviewPosition({ id: 'mgr-3', isAdmin: false }, ['mgr-1', 'mgr-2']),
    ).toBe(false);
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

describe('formatCountdown', () => {
  it('renders zero as 0:00', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('pads sub-minute seconds', () => {
    expect(formatCountdown(42)).toBe('0:42');
  });

  it('pads seconds within a minute', () => {
    expect(formatCountdown(95)).toBe('1:35');
  });

  it('renders the full cooldown', () => {
    expect(formatCountdown(OTP_RESEND_COOLDOWN_SECONDS)).toBe('3:00');
  });

  it('clamps a negative value to 0:00', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('getPaginationRange', () => {
  it('returns every page when there are 7 or fewer', () => {
    expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('windows around the current page with ellipses at both ends', () => {
    expect(getPaginationRange(5, 20)).toEqual([
      1,
      'ellipsis',
      4,
      5,
      6,
      'ellipsis',
      20,
    ]);
  });

  it('fills a gap of exactly one page instead of an ellipsis', () => {
    expect(getPaginationRange(4, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
  });

  it('has no leading ellipsis near the first page', () => {
    expect(getPaginationRange(1, 20)).toEqual([1, 2, 'ellipsis', 20]);
  });

  it('has no trailing ellipsis near the last page', () => {
    expect(getPaginationRange(20, 20)).toEqual([1, 'ellipsis', 19, 20]);
  });
});

describe('formatPaginationSummary', () => {
  it('shows a bare count when everything fits on one page', () => {
    expect(
      formatPaginationSummary({
        rangeStart: 1,
        rangeEnd: 18,
        total: 18,
        noun: 'application',
      }),
    ).toBe('18 applications');
  });

  it('uses the singular noun for a total of one', () => {
    expect(
      formatPaginationSummary({
        rangeStart: 1,
        rangeEnd: 1,
        total: 1,
        noun: 'application',
      }),
    ).toBe('1 application');
  });

  it('marks a single-page result as matching when filtered', () => {
    expect(
      formatPaginationSummary({
        rangeStart: 1,
        rangeEnd: 18,
        total: 18,
        noun: 'application',
        isFiltered: true,
      }),
    ).toBe('18 matching applications');
  });

  it('shows the range across multiple pages', () => {
    expect(
      formatPaginationSummary({
        rangeStart: 51,
        rangeEnd: 100,
        total: 412,
        noun: 'application',
      }),
    ).toBe('Showing 51–100 of 412 applications');
  });

  it('marks a multi-page range as matching when filtered', () => {
    expect(
      formatPaginationSummary({
        rangeStart: 1,
        rangeEnd: 50,
        total: 137,
        noun: 'application',
        isFiltered: true,
      }),
    ).toBe('Showing 1–50 of 137 matching applications');
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

describe('isSameIdSet', () => {
  it('is true for the same ids in a different order', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('is false for a different length', () => {
    expect(isSameIdSet(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('is false when an id is missing', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false);
  });

  it('is false when an extra id is injected', () => {
    expect(isSameIdSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('is false when either side has a duplicate', () => {
    expect(isSameIdSet(['a', 'a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'a', 'b'])).toBe(false);
  });
});

describe('resolveGlobalAnswerValues', () => {
  it('falls back to the profile value when no application row exists', () => {
    const resolved = resolveGlobalAnswerValues(
      ['q1'],
      [],
      [{ globalQuestionId: 'q1', value: ['profile'] }],
    );
    expect(resolved.get('q1')).toEqual(['profile']);
  });

  it('keeps a deliberately cleared application row empty, not the profile value', () => {
    const resolved = resolveGlobalAnswerValues(
      ['q1'],
      [{ globalQuestionId: 'q1', value: [] }],
      [{ globalQuestionId: 'q1', value: ['profile'] }],
    );
    expect(resolved.get('q1')).toEqual([]);
  });

  it('prefers a non-empty application row over the profile value', () => {
    const resolved = resolveGlobalAnswerValues(
      ['q1'],
      [{ globalQuestionId: 'q1', value: ['application'] }],
      [{ globalQuestionId: 'q1', value: ['profile'] }],
    );
    expect(resolved.get('q1')).toEqual(['application']);
  });

  it('resolves to an empty array when neither row exists', () => {
    const resolved = resolveGlobalAnswerValues(['q1'], [], []);
    expect(resolved.get('q1')).toEqual([]);
  });

  it('resolves every requested question id independently', () => {
    const resolved = resolveGlobalAnswerValues(
      ['q1', 'q2'],
      [{ globalQuestionId: 'q1', value: [] }],
      [
        { globalQuestionId: 'q1', value: ['profile1'] },
        { globalQuestionId: 'q2', value: ['profile2'] },
      ],
    );
    expect(resolved.get('q1')).toEqual([]);
    expect(resolved.get('q2')).toEqual(['profile2']);
  });
});

describe('findDivergingGlobalAnswers', () => {
  it('returns nothing when every current value equals its profile value', () => {
    const result = findDivergingGlobalAnswers(
      ['q1'],
      new Map([['q1', ['same']]]),
      [{ globalQuestionId: 'q1', value: ['same'] }],
    );
    expect(result).toEqual([]);
  });

  it('is not diverging when both sides are empty, including no profile row at all', () => {
    const result = findDivergingGlobalAnswers(
      ['q1', 'q2'],
      new Map([
        ['q1', []],
        ['q2', []],
      ]),
      [{ globalQuestionId: 'q1', value: [] }],
    );
    expect(result).toEqual([]);
  });

  it('returns only the diverging ids, in questionIds order, with the profile value a revert would write', () => {
    const result = findDivergingGlobalAnswers(
      ['q1', 'q2', 'q3'],
      new Map([
        ['q1', ['changed']],
        ['q2', ['same']],
        ['q3', ['also changed']],
      ]),
      [
        { globalQuestionId: 'q1', value: ['profile1'] },
        { globalQuestionId: 'q2', value: ['same'] },
        { globalQuestionId: 'q3', value: ['profile3'] },
      ],
    );
    expect(result).toEqual([
      { questionId: 'q1', profileValue: ['profile1'] },
      { questionId: 'q3', profileValue: ['profile3'] },
    ]);
  });

  it('treats a different array order as diverging', () => {
    const result = findDivergingGlobalAnswers(
      ['q1'],
      new Map([['q1', ['b', 'a']]]),
      [{ globalQuestionId: 'q1', value: ['a', 'b'] }],
    );
    expect(result).toEqual([{ questionId: 'q1', profileValue: ['a', 'b'] }]);
  });

  it('treats a whitespace-only difference as diverging', () => {
    const result = findDivergingGlobalAnswers(
      ['q1'],
      new Map([['q1', ['Yes ']]]),
      [{ globalQuestionId: 'q1', value: ['Yes'] }],
    );
    expect(result).toEqual([{ questionId: 'q1', profileValue: ['Yes'] }]);
  });

  it('diverges with an empty profileValue when no profile row exists but the current value is non-empty', () => {
    const result = findDivergingGlobalAnswers(
      ['q1'],
      new Map([['q1', ['answered']]]),
      [],
    );
    expect(result).toEqual([{ questionId: 'q1', profileValue: [] }]);
  });
});

describe('getUserName', () => {
  it('returns null for a null name', () => {
    expect(getUserName({ name: null })).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getUserName({ name: '' })).toBeNull();
  });

  it('returns null for a whitespace-only name', () => {
    expect(getUserName({ name: '   ' })).toBeNull();
  });

  it('returns a real name unchanged', () => {
    expect(getUserName({ name: 'Ada Lovelace' })).toBe('Ada Lovelace');
  });

  it('trims surrounding whitespace', () => {
    expect(getUserName({ name: '  Ada Lovelace  ' })).toBe('Ada Lovelace');
  });
});

describe('displayUserName', () => {
  it('falls back to email when the name is null', () => {
    expect(displayUserName({ name: null, email: 'ada@example.com' })).toBe(
      'ada@example.com',
    );
  });

  it('falls back to email when the name is blank', () => {
    expect(displayUserName({ name: '   ', email: 'ada@example.com' })).toBe(
      'ada@example.com',
    );
  });

  it('prefers a real name over the email', () => {
    expect(
      displayUserName({ name: 'Ada Lovelace', email: 'ada@example.com' }),
    ).toBe('Ada Lovelace');
  });
});

describe('getApplicantName', () => {
  it('prefers the frozen applicantName over the live user name', () => {
    expect(
      getApplicantName({
        applicantName: 'Frozen Name',
        user: { name: 'Live Name' },
      }),
    ).toBe('Frozen Name');
  });

  it('falls back to the live user name when applicantName is blank', () => {
    expect(
      getApplicantName({ applicantName: '   ', user: { name: 'Live Name' } }),
    ).toBe('Live Name');
  });

  it('falls back to the live user name when applicantName is null', () => {
    expect(
      getApplicantName({ applicantName: null, user: { name: 'Live Name' } }),
    ).toBe('Live Name');
  });

  it('returns null when neither name is set', () => {
    expect(
      getApplicantName({ applicantName: '', user: { name: null } }),
    ).toBeNull();
  });
});
