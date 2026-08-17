import { describe, expect, it } from 'vitest';

import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_OTHER_MAX_LENGTH,
  ANSWER_SHORT_MAX_LENGTH,
  NON_TERMINAL_APPLICATION_STATUSES,
  REVIEWER_APPLICATION_STATUSES,
  TERMINAL_DECISION_STATUSES,
  UNRESOLVED_APPLICATION_STATUSES,
  getAnswerValueError,
  matchesShortAnswerFormat,
} from '@/lib/constants';

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

describe('status-set invariants', () => {
  it('REVIEWER_APPLICATION_STATUSES excludes draft and withdrawn', () => {
    expect(REVIEWER_APPLICATION_STATUSES).not.toContain('draft');
    expect(REVIEWER_APPLICATION_STATUSES).not.toContain('withdrawn');
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
