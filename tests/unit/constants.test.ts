import { describe, expect, it } from 'vitest';

import type { PositionStatus } from '@/prisma/client';

import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_OTHER_MAX_LENGTH,
  ANSWER_SHORT_MAX_LENGTH,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VALUES,
  EMAIL_STATUS_BADGE_VARIANT,
  EMAIL_STATUS_DESCRIPTIONS,
  EMAIL_STATUS_LABELS,
  EMAIL_STATUS_OPTIONS,
  EMAIL_STATUS_VALUES,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_OPTIONS,
  EMAIL_TEMPLATE_VALUES,
  NON_TERMINAL_APPLICATION_STATUSES,
  POSITION_CLOSES_AT_ORDER_ERROR,
  POSITION_CLOSES_AT_PAST_ERROR,
  POSITION_DATE_INCOMPLETE_ERROR,
  POSITION_OPENS_AT_ORDER_ERROR,
  POSITION_OPENS_AT_PAST_ERROR,
  POSITION_STATUS_TRANSITIONS,
  POSITION_TRANSITION_ACTIONS,
  REVIEWER_APPLICATION_STATUSES,
  REVIEWER_APPLICATION_STATUS_OPTIONS,
  TERMINAL_DECISION_STATUSES,
  UNRESOLVED_APPLICATION_STATUSES,
  formatPhoneNumber,
  formatShortAnswerValue,
  getAnswerBlurError,
  getAnswerValueError,
  getStatusOptions,
  makePositionFormSchema,
  matchesShortAnswerFormat,
  normalizePhoneNumber,
  normalizeShortAnswerValue,
  positionDateOrderIssues,
  positionPastDateIssues,
  positionScheduleClearIssues,
  positionScheduleIssues,
} from '@/lib/constants';
import { toOrgDayString } from '@/lib/dates';

const choiceQuestion = { options: ['a', 'b'], allowOther: false };
const choiceQuestionWithOther = { options: ['a', 'b'], allowOther: true };

describe('getAnswerValueError', () => {
  it('allows an empty value for every type', () => {
    expect(
      getAnswerValueError({ type: 'short_answer', ...choiceQuestion }, []),
    ).toBeNull();
  });

  describe('short_answer', () => {
    it('rejects more than one value', () => {
      expect(
        getAnswerValueError({ type: 'short_answer', ...choiceQuestion }, [
          'a',
          'b',
        ]),
      ).toBe('Only one answer is allowed for this question.');
    });

    it('rejects a value over the length limit', () => {
      const long = 'x'.repeat(ANSWER_SHORT_MAX_LENGTH + 1);
      expect(
        getAnswerValueError({ type: 'short_answer', ...choiceQuestion }, [
          long,
        ]),
      ).toBe(`Answer must be ${ANSWER_SHORT_MAX_LENGTH} characters or fewer.`);
    });

    it('allows a value within the limit', () => {
      expect(
        getAnswerValueError({ type: 'short_answer', ...choiceQuestion }, [
          'ok',
        ]),
      ).toBeNull();
    });
  });

  describe('long_answer', () => {
    it('rejects a value over the length limit', () => {
      const long = 'x'.repeat(ANSWER_LONG_MAX_LENGTH + 1);
      expect(
        getAnswerValueError({ type: 'long_answer', ...choiceQuestion }, [long]),
      ).toBe(`Answer must be ${ANSWER_LONG_MAX_LENGTH} characters or fewer.`);
    });
  });

  describe('single_choice', () => {
    it('accepts a current option', () => {
      expect(
        getAnswerValueError({ type: 'single_choice', ...choiceQuestion }, [
          'a',
        ]),
      ).toBeNull();
    });

    it('rejects a stale choice when Other is not allowed', () => {
      expect(
        getAnswerValueError({ type: 'single_choice', ...choiceQuestion }, [
          'z',
        ]),
      ).toBe(
        'That choice is no longer available. Refresh the page and answer again.',
      );
    });

    it('accepts a free-text Other entry within the length limit', () => {
      expect(
        getAnswerValueError(
          { type: 'single_choice', ...choiceQuestionWithOther },
          ['z'],
        ),
      ).toBeNull();
    });

    it('rejects an oversized Other entry', () => {
      const long = 'x'.repeat(ANSWER_OTHER_MAX_LENGTH + 1);
      expect(
        getAnswerValueError(
          { type: 'single_choice', ...choiceQuestionWithOther },
          [long],
        ),
      ).toBe(`Answer must be ${ANSWER_OTHER_MAX_LENGTH} characters or fewer.`);
    });

    it('rejects more than one value', () => {
      expect(
        getAnswerValueError({ type: 'single_choice', ...choiceQuestion }, [
          'a',
          'b',
        ]),
      ).toBe('Only one answer is allowed for this question.');
    });
  });

  describe('multiple_choice', () => {
    it('accepts current options', () => {
      expect(
        getAnswerValueError({ type: 'multiple_choice', ...choiceQuestion }, [
          'a',
          'b',
        ]),
      ).toBeNull();
    });

    it('rejects a duplicate entry', () => {
      expect(
        getAnswerValueError(
          { type: 'multiple_choice', ...choiceQuestionWithOther },
          ['a', 'a'],
        ),
      ).toBe(
        'That answer is already one of the choices — select it from the list instead.',
      );
    });

    it('rejects a stale choice when Other is not allowed', () => {
      expect(
        getAnswerValueError({ type: 'multiple_choice', ...choiceQuestion }, [
          'a',
          'z',
        ]),
      ).toBe(
        'That choice is no longer available. Refresh the page and answer again.',
      );
    });

    it('accepts options plus one free-text Other entry', () => {
      expect(
        getAnswerValueError(
          { type: 'multiple_choice', ...choiceQuestionWithOther },
          ['a', 'z'],
        ),
      ).toBeNull();
    });

    it('rejects more than one Other entry', () => {
      expect(
        getAnswerValueError(
          { type: 'multiple_choice', ...choiceQuestionWithOther },
          ['z', 'y'],
        ),
      ).toBe('Only one "Other" answer is allowed.');
    });

    it('rejects an oversized Other entry', () => {
      const long = 'x'.repeat(ANSWER_OTHER_MAX_LENGTH + 1);
      expect(
        getAnswerValueError(
          { type: 'multiple_choice', ...choiceQuestionWithOther },
          [long],
        ),
      ).toBe(`Answer must be ${ANSWER_OTHER_MAX_LENGTH} characters or fewer.`);
    });
  });

  describe('file_upload', () => {
    it('always passes through', () => {
      expect(
        getAnswerValueError({ type: 'file_upload', ...choiceQuestion }, [
          'https://blob.example.com/f.pdf',
        ]),
      ).toBeNull();
    });
  });
});

describe('getAnswerBlurError', () => {
  const formattedQuestion = {
    type: 'short_answer' as const,
    format: 'email' as const,
    ...choiceQuestion,
  };

  it('rejects a bad format before the value rules run', () => {
    expect(getAnswerBlurError(formattedQuestion, ['not-an-email'])).toBe(
      'Enter a valid email address',
    );
  });

  it('falls through to getAnswerValueError once the format is fine', () => {
    expect(getAnswerBlurError(formattedQuestion, ['a@b.com', 'extra'])).toBe(
      'Only one answer is allowed for this question.',
    );
  });

  it('allows a value matching both the format and the value rules', () => {
    expect(getAnswerBlurError(formattedQuestion, ['a@b.com'])).toBeNull();
  });

  it('skips the format check for a question without one', () => {
    expect(
      getAnswerBlurError(
        { type: 'short_answer', format: null, ...choiceQuestion },
        ['ok'],
      ),
    ).toBeNull();
  });
});

describe('matchesShortAnswerFormat', () => {
  it('accepts a valid email', () => {
    expect(matchesShortAnswerFormat('a@b.com', 'email')).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(matchesShortAnswerFormat('not-an-email', 'email')).toBe(false);
  });

  it('trims whitespace before matching', () => {
    expect(matchesShortAnswerFormat('  a@b.com  ', 'email')).toBe(true);
  });

  it('accepts a valid phone number', () => {
    expect(matchesShortAnswerFormat('+1 (617) 555-0100', 'phone_number')).toBe(
      true,
    );
  });

  it('rejects an invalid phone number', () => {
    expect(matchesShortAnswerFormat('abc', 'phone_number')).toBe(false);
  });

  it('accepts a valid url', () => {
    expect(matchesShortAnswerFormat('https://example.com', 'url')).toBe(true);
  });

  it('rejects an invalid url', () => {
    expect(matchesShortAnswerFormat('not a url', 'url')).toBe(false);
  });

  it('accepts a valid zip code', () => {
    expect(matchesShortAnswerFormat('02115', 'zip_code')).toBe(true);
  });

  it('rejects an invalid zip code', () => {
    expect(matchesShortAnswerFormat('abcde', 'zip_code')).toBe(false);
  });
});

describe('normalizePhoneNumber / formatPhoneNumber', () => {
  it('round-trips a bare 10-digit number', () => {
    expect(normalizePhoneNumber('5551234567')).toBe('5551234567');
    expect(formatPhoneNumber(normalizePhoneNumber('5551234567'))).toBe(
      '(555) 123-4567',
    );
  });

  it('round-trips a legacy punctuated 10-digit number', () => {
    expect(normalizePhoneNumber('(555) 123-4567')).toBe('5551234567');
    expect(formatPhoneNumber(normalizePhoneNumber('(555) 123-4567'))).toBe(
      '(555) 123-4567',
    );
  });

  it('round-trips an 11-digit number with a leading 1 and +', () => {
    expect(normalizePhoneNumber('+1 555 123 4567')).toBe('+15551234567');
    expect(formatPhoneNumber(normalizePhoneNumber('+1 555 123 4567'))).toBe(
      '(555) 123-4567',
    );
  });

  it('leaves an already-normalized value unchanged', () => {
    expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
    expect(formatPhoneNumber('+15551234567')).toBe('(555) 123-4567');
  });

  it('round-trips a + international number by rendering unchanged', () => {
    expect(normalizePhoneNumber('+44 20 7123 4567')).toBe('+442071234567');
    expect(formatPhoneNumber(normalizePhoneNumber('+44 20 7123 4567'))).toBe(
      '+442071234567',
    );
  });

  it('round-trips a 00 international number, promoting the prefix to +', () => {
    expect(normalizePhoneNumber('0044 20 7123 4567')).toBe('+442071234567');
    expect(formatPhoneNumber(normalizePhoneNumber('0044 20 7123 4567'))).toBe(
      '+442071234567',
    );
  });

  it('round-trips a 7-digit local number by rendering unchanged', () => {
    expect(normalizePhoneNumber('555-0100')).toBe('5550100');
    expect(formatPhoneNumber(normalizePhoneNumber('555-0100'))).toBe('5550100');
  });

  it('round-trips a validator-passing value that fits no mask', () => {
    expect(normalizePhoneNumber('12345678901234')).toBe('12345678901234');
    expect(formatPhoneNumber(normalizePhoneNumber('12345678901234'))).toBe(
      '12345678901234',
    );
  });

  it('returns unparseable input unchanged from normalize', () => {
    expect(normalizePhoneNumber('abc')).toBe('abc');
  });
});

describe('normalizeShortAnswerValue / formatShortAnswerValue', () => {
  it('normalizes a phone_number value', () => {
    expect(normalizeShortAnswerValue('(617) 555-0100', 'phone_number')).toBe(
      '6175550100',
    );
  });

  it('formats a phone_number value', () => {
    expect(formatShortAnswerValue('6175550100', 'phone_number')).toBe(
      '(617) 555-0100',
    );
  });

  it('trims but otherwise leaves email/url/zip_code unchanged on normalize', () => {
    expect(normalizeShortAnswerValue('  a@b.com  ', 'email')).toBe('a@b.com');
    expect(normalizeShortAnswerValue('  example.com  ', 'url')).toBe(
      'example.com',
    );
    expect(normalizeShortAnswerValue('  02115  ', 'zip_code')).toBe('02115');
  });

  it('is the identity on format for email/url/zip_code and a null format', () => {
    expect(formatShortAnswerValue('a@b.com', 'email')).toBe('a@b.com');
    expect(formatShortAnswerValue('example.com', 'url')).toBe('example.com');
    expect(formatShortAnswerValue('02115', 'zip_code')).toBe('02115');
    expect(formatShortAnswerValue('6175550100', null)).toBe('6175550100');
  });
});

describe('status-set invariants', () => {
  it('REVIEWER_APPLICATION_STATUSES excludes draft and withdrawn', () => {
    expect(REVIEWER_APPLICATION_STATUSES).not.toContain('draft');
    expect(REVIEWER_APPLICATION_STATUSES).not.toContain('withdrawn');
  });

  it("APPLICATION_STATUS_VALUES (the queue's filter list) includes draft and withdrawn", () => {
    expect(APPLICATION_STATUS_VALUES).toContain('draft');
    expect(APPLICATION_STATUS_VALUES).toContain('withdrawn');
    expect(REVIEWER_APPLICATION_STATUSES).not.toContain('draft');
  });

  it('APPLICATION_STATUS_VALUES covers every key of APPLICATION_STATUS_LABELS', () => {
    expect(new Set(APPLICATION_STATUS_VALUES)).toEqual(
      new Set(Object.keys(APPLICATION_STATUS_LABELS)),
    );
  });

  it('REVIEWER_APPLICATION_STATUS_OPTIONS contains neither draft nor withdrawn', () => {
    const values = REVIEWER_APPLICATION_STATUS_OPTIONS.map((o) => o.value);
    expect(values).not.toContain('draft');
    expect(values).not.toContain('withdrawn');
  });

  it('UNRESOLVED_APPLICATION_STATUSES is a subset of NON_TERMINAL_APPLICATION_STATUSES', () => {
    for (const status of UNRESOLVED_APPLICATION_STATUSES)
      expect(NON_TERMINAL_APPLICATION_STATUSES).toContain(status);
  });

  it('TERMINAL_DECISION_STATUSES is disjoint from UNRESOLVED_APPLICATION_STATUSES', () => {
    for (const status of TERMINAL_DECISION_STATUSES)
      expect(UNRESOLVED_APPLICATION_STATUSES).not.toContain(status);
  });
});

describe('EMAIL_STATUS_* maps', () => {
  it('has a description entry for every EmailStatus member', () => {
    for (const status of EMAIL_STATUS_VALUES)
      expect(EMAIL_STATUS_DESCRIPTIONS).toHaveProperty(status);
  });
});

describe('email vocabulary', () => {
  it('EMAIL_STATUS_LABELS is total over EMAIL_STATUS_VALUES', () => {
    for (const status of EMAIL_STATUS_VALUES)
      expect(EMAIL_STATUS_LABELS[status]).toBeTruthy();
  });

  it('EMAIL_STATUS_BADGE_VARIANT is total over EMAIL_STATUS_VALUES', () => {
    for (const status of EMAIL_STATUS_VALUES)
      expect(EMAIL_STATUS_BADGE_VARIANT[status]).toBeTruthy();
  });

  it("'sent' is not mapped to the 'success' badge variant", () => {
    expect(EMAIL_STATUS_BADGE_VARIANT.sent).not.toBe('success');
    expect(EMAIL_STATUS_BADGE_VARIANT.delivered).toBe('success');
  });

  it('EMAIL_TEMPLATE_LABELS is total over EMAIL_TEMPLATE_VALUES', () => {
    for (const template of EMAIL_TEMPLATE_VALUES)
      expect(EMAIL_TEMPLATE_LABELS[template]).toBeTruthy();
  });

  it('EMAIL_STATUS_OPTIONS matches EMAIL_STATUS_VALUES', () => {
    expect(EMAIL_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      ...EMAIL_STATUS_VALUES,
    ]);
  });

  it('EMAIL_TEMPLATE_OPTIONS matches EMAIL_TEMPLATE_VALUES', () => {
    expect(EMAIL_TEMPLATE_OPTIONS.map((o) => o.value)).toEqual([
      ...EMAIL_TEMPLATE_VALUES,
    ]);
  });
});

describe('validatePositionDates / positionPastDateIssues (via makePositionFormSchema)', () => {
  const base = { title: 'Title', description: '', status: 'draft' } as const;
  // Fixed reference day — every literal below is on or after it.
  const today = '2026-01-01';

  it('accepts a valid pair', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '2026-01-01',
      closesAt: '2026-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an inverted pair, naming both fields', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '2026-01-31',
      closesAt: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('opensAt');
    expect(paths).toContain('closesAt');
    const opensAtIssue = result.error.issues.find(
      (issue) => issue.path.join('.') === 'opensAt',
    );
    const closesAtIssue = result.error.issues.find(
      (issue) => issue.path.join('.') === 'closesAt',
    );
    expect(opensAtIssue?.message).toBe(POSITION_OPENS_AT_ORDER_ERROR);
    expect(closesAtIssue?.message).toBe(POSITION_CLOSES_AT_ORDER_ERROR);
  });

  it('accepts the same day for both', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '2026-01-01',
      closesAt: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts opensAt alone', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '2026-01-01',
      closesAt: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts closesAt alone', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '',
      closesAt: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts neither date', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: '',
      closesAt: '',
    });
    expect(result.success).toBe(true);
  });

  it('reports a field-level error for a malformed date without crashing', () => {
    const result = makePositionFormSchema(today).safeParse({
      ...base,
      opensAt: 'not-a-date',
      closesAt: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path.join('.') === 'opensAt'),
    ).toBe(true);
  });

  it('rejects an opensAt before today', () => {
    const result = makePositionFormSchema('2026-06-01').safeParse({
      ...base,
      opensAt: '2026-05-31',
      closesAt: '',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(POSITION_OPENS_AT_PAST_ERROR);
  });

  it('accepts an opensAt of today', () => {
    const result = makePositionFormSchema('2026-06-01').safeParse({
      ...base,
      opensAt: '2026-06-01',
      closesAt: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an opensAt in the future', () => {
    const result = makePositionFormSchema('2026-06-01').safeParse({
      ...base,
      opensAt: '2026-06-02',
      closesAt: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a closesAt before today', () => {
    const result = makePositionFormSchema('2026-06-01').safeParse({
      ...base,
      opensAt: '',
      closesAt: '2026-05-31',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(POSITION_CLOSES_AT_PAST_ERROR);
  });

  it('accepts a closesAt of today', () => {
    const result = makePositionFormSchema('2026-06-01').safeParse({
      ...base,
      opensAt: '',
      closesAt: '2026-06-01',
    });
    expect(result.success).toBe(true);
  });

  it('leaves an unchanged past opensAt alone on edit', () => {
    const result = makePositionFormSchema('2026-06-01', {
      opensAt: '2026-05-01',
    }).safeParse({ ...base, opensAt: '2026-05-01', closesAt: '' });
    expect(result.success).toBe(true);
  });

  it('rejects opensAt changed to a past date on edit', () => {
    const result = makePositionFormSchema('2026-06-01', {
      opensAt: '2026-05-01',
    }).safeParse({ ...base, opensAt: '2026-05-15', closesAt: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(POSITION_OPENS_AT_PAST_ERROR);
  });

  // Guards against a host-timezone regression: this asserts against the real
  // "today" under TZ=Asia/Tokyo (the unit project's env), not a fixed literal.
  it('derives today from toOrgDayString(new Date())', () => {
    const result = makePositionFormSchema(toOrgDayString(new Date())).safeParse(
      { ...base, opensAt: '2000-01-01', closesAt: '' },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(POSITION_OPENS_AT_PAST_ERROR);
  });
});

describe('getStatusOptions', () => {
  it('offers every status to an admin, regardless of current status', () => {
    expect(getStatusOptions(true).map((o) => o.value)).toContain('open');
    expect(getStatusOptions(true, 'closed').map((o) => o.value)).toContain(
      'open',
    );
  });

  it('omits open for a manager with no current status (create)', () => {
    expect(getStatusOptions(false).map((o) => o.value)).toEqual([
      'draft',
      'closed',
    ]);
  });

  it('keeps open selectable for a manager when the position is already open', () => {
    expect(getStatusOptions(false, 'open').map((o) => o.value)).toContain(
      'open',
    );
  });

  it('omits open for a manager editing a draft or closed position', () => {
    expect(getStatusOptions(false, 'draft').map((o) => o.value)).not.toContain(
      'open',
    );
    expect(getStatusOptions(false, 'closed').map((o) => o.value)).not.toContain(
      'open',
    );
  });
});

describe('positionPastDateIssues — the schedule autosave pair', () => {
  const today = '2026-06-01';

  it('flags only the date the caller actually changed', () => {
    // opensAt unchanged from previous (still past); closesAt newly set to a past date.
    const issues = positionPastDateIssues(
      { opensAt: '2026-05-01', closesAt: '2026-05-15' },
      today,
      { opensAt: '2026-05-01' },
    );
    expect(issues.map((i) => i.path)).toEqual(['closesAt']);
  });

  it('is silent on an unchanged past date with nothing else touched', () => {
    const issues = positionPastDateIssues(
      { opensAt: '2026-05-01', closesAt: undefined },
      today,
      { opensAt: '2026-05-01' },
    );
    expect(issues).toEqual([]);
  });

  it('is silent on an empty/mid-typing value rather than erroring', () => {
    const issues = positionPastDateIssues(
      { opensAt: '', closesAt: '2026-06-15' },
      today,
      {},
    );
    expect(issues).toEqual([]);
  });

  // The ordering case itself is covered above, via makePositionFormSchema's
  // 'rejects an inverted pair' test — validatePositionDates is the same
  // refinement makePositionFormSchema runs.
});

describe('positionDateOrderIssues', () => {
  it('rejects an inverted pair, naming both fields', () => {
    const issues = positionDateOrderIssues({
      opensAt: '2026-01-31',
      closesAt: '2026-01-01',
    });
    expect(issues).toEqual([
      { path: 'opensAt', message: POSITION_OPENS_AT_ORDER_ERROR },
      { path: 'closesAt', message: POSITION_CLOSES_AT_ORDER_ERROR },
    ]);
  });

  it('is silent when either side is missing', () => {
    expect(positionDateOrderIssues({ opensAt: '2026-01-31' })).toEqual([]);
    expect(positionDateOrderIssues({ closesAt: '2026-01-01' })).toEqual([]);
  });
});

describe('positionScheduleIssues — the Clear-control commit decision', () => {
  const today = '2026-06-01';

  it('yields only the incomplete error on an incomplete field, suppressing order and past checks', () => {
    const issues = positionScheduleIssues(
      { opensAt: '', closesAt: '2026-05-01' },
      { opensAt: true, closesAt: false },
      today,
      {},
    );
    expect(issues).toEqual([
      { path: 'opensAt', message: POSITION_DATE_INCOMPLETE_ERROR },
    ]);
  });

  it('reports both incomplete fields and nothing else, even with an otherwise valid other change', () => {
    const issues = positionScheduleIssues(
      { opensAt: '', closesAt: '' },
      { opensAt: true, closesAt: true },
      today,
      { opensAt: '2026-06-10', closesAt: '2026-06-20' },
    );
    expect(issues).toEqual([
      { path: 'opensAt', message: POSITION_DATE_INCOMPLETE_ERROR },
      { path: 'closesAt', message: POSITION_DATE_INCOMPLETE_ERROR },
    ]);
  });

  it('allows an explicit clear of both fields when neither is incomplete', () => {
    const issues = positionScheduleIssues(
      { opensAt: '', closesAt: '' },
      { opensAt: false, closesAt: false },
      today,
      { opensAt: '2026-06-10', closesAt: '2026-06-20' },
    );
    expect(issues).toEqual([]);
  });

  it('allows clearing one field while the other holds an unchanged past date', () => {
    const issues = positionScheduleIssues(
      { opensAt: '', closesAt: '2026-05-01' },
      { opensAt: false, closesAt: false },
      today,
      { opensAt: '2026-05-15', closesAt: '2026-05-01' },
    );
    expect(issues).toEqual([]);
  });

  it('allows clearing a field whose previous value is in the past', () => {
    const issues = positionScheduleIssues(
      { opensAt: '', closesAt: '' },
      { opensAt: false, closesAt: false },
      today,
      { opensAt: '2026-05-01', closesAt: '2026-05-15' },
    );
    expect(issues).toEqual([]);
  });

  it('still reports both order messages for an out-of-order pair', () => {
    const issues = positionScheduleIssues(
      { opensAt: '2026-06-20', closesAt: '2026-06-10' },
      { opensAt: false, closesAt: false },
      today,
      {},
    );
    expect(issues).toEqual([
      { path: 'opensAt', message: POSITION_OPENS_AT_ORDER_ERROR },
      { path: 'closesAt', message: POSITION_CLOSES_AT_ORDER_ERROR },
    ]);
  });
});

describe('positionScheduleClearIssues — the mobile Clear-tap decision', () => {
  const today = '2026-06-01';

  it('is silent on the field being cleared even if its own node still reports badInput', () => {
    const issues = positionScheduleClearIssues(
      'opensAt',
      { opensAt: '2026-06-10', closesAt: '' },
      { opensAt: true, closesAt: false },
      today,
      {},
    );
    expect(issues).toEqual([]);
  });

  it('blocks on an incomplete sibling, naming only the sibling', () => {
    const issues = positionScheduleClearIssues(
      'opensAt',
      { opensAt: '2026-06-10', closesAt: '' },
      { opensAt: false, closesAt: true },
      today,
      {},
    );
    expect(issues).toEqual([
      { path: 'closesAt', message: POSITION_DATE_INCOMPLETE_ERROR },
    ]);
  });

  it('allows the clear when the sibling holds an unchanged past date', () => {
    const issues = positionScheduleClearIssues(
      'opensAt',
      { opensAt: '2026-06-10', closesAt: '2026-05-01' },
      { opensAt: false, closesAt: false },
      today,
      { opensAt: '2026-06-10', closesAt: '2026-05-01' },
    );
    expect(issues).toEqual([]);
  });

  it('allows clearing one half of an out-of-order pair', () => {
    const issues = positionScheduleClearIssues(
      'closesAt',
      { opensAt: '2026-06-20', closesAt: '2026-06-10' },
      { opensAt: false, closesAt: false },
      today,
      {},
    );
    expect(issues).toEqual([]);
  });

  it('blocks when the sibling was changed to a past date', () => {
    const issues = positionScheduleClearIssues(
      'opensAt',
      { opensAt: '2026-06-10', closesAt: '2026-05-01' },
      { opensAt: false, closesAt: false },
      today,
      { opensAt: '2026-06-10', closesAt: '2026-06-20' },
    );
    expect(issues).toEqual([
      { path: 'closesAt', message: POSITION_CLOSES_AT_PAST_ERROR },
    ]);
  });
});

describe('POSITION_TRANSITION_ACTIONS', () => {
  it('covers exactly the pairs POSITION_STATUS_TRANSITIONS allows', () => {
    for (const from of Object.keys(
      POSITION_STATUS_TRANSITIONS,
    ) as PositionStatus[]) {
      const allowedTargets = POSITION_STATUS_TRANSITIONS[from];
      const actionTargets = Object.keys(POSITION_TRANSITION_ACTIONS[from]);
      expect(new Set(actionTargets)).toEqual(new Set(allowedTargets));
    }
  });
});
