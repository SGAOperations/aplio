import { describe, expect, it } from 'vitest';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_TRANSITIONS,
  APPLICATION_STATUS_VALUES,
  REJECTABLE_APPLICATION_STATUSES,
  getAllowedApplicationStatusTransitions,
  getApplicationStatusSources,
  isAllowedApplicationStatusTransition,
} from '@/lib/constants';

const ALL_STATUSES: $Enums.ApplicationStatus[] = [
  ...APPLICATION_STATUS_VALUES,
  'withdrawn',
];

describe('APPLICATION_STATUS_TRANSITIONS', () => {
  it('is total over every ApplicationStatus', () => {
    for (const status of ALL_STATUSES)
      expect(APPLICATION_STATUS_TRANSITIONS[status]).toBeDefined();
  });

  it('never lists a state as its own forward or back target', () => {
    for (const status of ALL_STATUSES) {
      const { forward, back } = APPLICATION_STATUS_TRANSITIONS[status];
      expect(forward).not.toContain(status);
      expect(back).not.toContain(status);
    }
  });

  it('gives draft and withdrawn no moves at all', () => {
    for (const status of ['draft', 'withdrawn'] as const)
      expect(getAllowedApplicationStatusTransitions(status)).toEqual([]);
  });

  it('never allows a move into draft or withdrawn', () => {
    for (const from of ALL_STATUSES)
      for (const to of getAllowedApplicationStatusTransitions(from)) {
        expect(to).not.toBe('draft');
        expect(to).not.toBe('withdrawn');
      }
  });
});

describe('rejected reachability', () => {
  it('allows rejected from exactly REJECTABLE_APPLICATION_STATUSES', () => {
    for (const status of ALL_STATUSES) {
      const canReject = isAllowedApplicationStatusTransition(
        status,
        'rejected',
      );
      const expected = (
        REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(status);
      expect(canReject).toBe(expected);
    }
  });
});

describe('getApplicationStatusSources', () => {
  it('is the exact inverse of getAllowedApplicationStatusTransitions', () => {
    for (const to of ALL_STATUSES) {
      const sources = getApplicationStatusSources(to);
      const expected = ALL_STATUSES.filter((from) =>
        isAllowedApplicationStatusTransition(from, to),
      );
      expect(new Set(sources)).toEqual(new Set(expected));
    }
  });
});
