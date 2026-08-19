import { describe, expect, it } from 'vitest';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  APPLICATION_STATUS_TRANSITIONS,
  APPLICATION_STATUS_VALUES,
  REJECTABLE_APPLICATION_STATUSES,
  getAllowedApplicationStatusTransitions,
  getApplicationStatusForwardSources,
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

describe('APPLICATION_STATUS_ACTION_LABELS', () => {
  it('describes interview_scheduled as a status, not an imperative action', () => {
    expect(APPLICATION_STATUS_ACTION_LABELS.interview_scheduled).toBe(
      'Interview scheduled',
    );
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

describe('getApplicationStatusForwardSources', () => {
  const forwardOrRejectSources = (
    to: $Enums.ApplicationStatus,
  ): $Enums.ApplicationStatus[] =>
    ALL_STATUSES.filter((from) => {
      const { forward } = APPLICATION_STATUS_TRANSITIONS[from];
      const isRejectable = (
        REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(from);
      return (
        (forward as readonly $Enums.ApplicationStatus[]).includes(to) ||
        (isRejectable && to === 'rejected')
      );
    });

  const backSources = (
    to: $Enums.ApplicationStatus,
  ): $Enums.ApplicationStatus[] =>
    ALL_STATUSES.filter((from) =>
      (
        APPLICATION_STATUS_TRANSITIONS[from]
          .back as readonly $Enums.ApplicationStatus[]
      ).includes(to),
    );

  it('prefers forward/reject sources whenever any exist', () => {
    for (const to of ALL_STATUSES) {
      const forward = forwardOrRejectSources(to);
      if (forward.length === 0) continue;
      expect(new Set(getApplicationStatusForwardSources(to))).toEqual(
        new Set(forward),
      );
    }
  });

  it('falls back to back-sources when a target has no forward source', () => {
    const backOnlyTargets = ALL_STATUSES.filter(
      (to) => forwardOrRejectSources(to).length === 0,
    );
    // Guards against this loop vacuously passing if the graph ever changes.
    expect(backOnlyTargets).not.toHaveLength(0);

    for (const to of backOnlyTargets)
      expect(new Set(getApplicationStatusForwardSources(to))).toEqual(
        new Set(backSources(to)),
      );
  });
});
