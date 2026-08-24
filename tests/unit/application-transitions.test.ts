import { describe, expect, it } from 'vitest';

import type { $Enums } from '@/prisma/client';

import {
  ACCEPTABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS_ACTION_LABELS,
  APPLICATION_STATUS_TRANSITIONS,
  APPLICATION_STATUS_VALUES,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  REJECTABLE_APPLICATION_STATUSES,
  getAllowedApplicationStatusTransitions,
  getApplicationStatusForwardSources,
  getApplicationStatusMenuGroups,
  getApplicationStatusUndoTarget,
  isAllowedApplicationStatusTransition,
} from '@/lib/constants';
import { getApplicationStatusHistoryRowLabel } from '@/lib/utils';

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

describe('getApplicationStatusForwardSources', () => {
  const forwardOrRejectSources = (
    to: $Enums.ApplicationStatus,
  ): $Enums.ApplicationStatus[] =>
    ALL_STATUSES.filter((from) => {
      const { forward } = APPLICATION_STATUS_TRANSITIONS[from];
      const isAcceptable = (
        ACCEPTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(from);
      const isRejectable = (
        REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(from);
      return (
        (forward as readonly $Enums.ApplicationStatus[]).includes(to) ||
        (isAcceptable && to === 'accepted') ||
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

  it('accepted is reachable from all four unresolved statuses', () => {
    expect(new Set(getApplicationStatusForwardSources('accepted'))).toEqual(
      new Set(ACCEPTABLE_APPLICATION_STATUSES),
    );
  });
});

describe('accepted reachability', () => {
  it('allows accepted from exactly ACCEPTABLE_APPLICATION_STATUSES, mirroring rejected', () => {
    for (const status of ALL_STATUSES) {
      const canAccept = isAllowedApplicationStatusTransition(
        status,
        'accepted',
      );
      const expected = (
        ACCEPTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(status);
      expect(canAccept).toBe(expected);
    }
  });

  it('never lists accepted in a forward array — only via ACCEPTABLE_APPLICATION_STATUSES', () => {
    for (const status of ALL_STATUSES)
      expect(APPLICATION_STATUS_TRANSITIONS[status].forward).not.toContain(
        'accepted',
      );
  });

  it('is offered from every unresolved status, none of the non-reviewable ones', () => {
    for (const status of NON_REVIEWABLE_APPLICATION_STATUSES)
      expect(getAllowedApplicationStatusTransitions(status)).not.toContain(
        'accepted',
      );
  });
});

describe('getApplicationStatusMenuGroups', () => {
  it('puts forward above, decisions below, and never a back move in either group', () => {
    for (const from of ALL_STATUSES) {
      const { forward: expectedForward, back } =
        APPLICATION_STATUS_TRANSITIONS[from];
      const { forward, decisions } = getApplicationStatusMenuGroups(from);

      expect(forward).toEqual([...expectedForward]);
      for (const backTarget of back)
        expect(decisions).not.toContain(backTarget);
      for (const backTarget of back) expect(forward).not.toContain(backTarget);
    }
  });

  it('matches ACCEPTABLE/REJECTABLE membership for the decisions group', () => {
    for (const from of ALL_STATUSES) {
      const { decisions } = getApplicationStatusMenuGroups(from);
      const isAcceptable = (
        ACCEPTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(from);
      const isRejectable = (
        REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(from);
      expect(decisions.includes('accepted')).toBe(isAcceptable);
      expect(decisions.includes('rejected')).toBe(isRejectable);
    }
  });
});

describe('getApplicationStatusUndoTarget', () => {
  it('is null with no events', () => {
    expect(getApplicationStatusUndoTarget(null)).toBeNull();
    expect(getApplicationStatusUndoTarget(undefined)).toBeNull();
  });

  it('is null for the backfill row (from: null)', () => {
    expect(getApplicationStatusUndoTarget({ from: null })).toBeNull();
  });

  it('is null when the prior status is draft or withdrawn', () => {
    expect(getApplicationStatusUndoTarget({ from: 'draft' })).toBeNull();
    expect(getApplicationStatusUndoTarget({ from: 'withdrawn' })).toBeNull();
  });

  it('returns the prior status otherwise', () => {
    expect(getApplicationStatusUndoTarget({ from: 'reviewing' })).toBe(
      'reviewing',
    );
    expect(getApplicationStatusUndoTarget({ from: 'accepted' })).toBe(
      'accepted',
    );
  });
});

describe('getApplicationStatusHistoryRowLabel', () => {
  it('renders the backfill copy for a null-from event', () => {
    expect(
      getApplicationStatusHistoryRowLabel({ from: null, to: 'applied' }),
    ).toBe('Status recorded as Applied');
  });

  it('renders "<From> → <To>" otherwise', () => {
    expect(
      getApplicationStatusHistoryRowLabel({ from: 'applied', to: 'reviewing' }),
    ).toBe('Applied → Reviewing');
  });
});
