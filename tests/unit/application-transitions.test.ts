import { describe, expect, it } from 'vitest';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  APPLICATION_STATUS_PATH,
  APPLICATION_STATUS_VALUES,
  UNRESOLVED_APPLICATION_STATUSES,
  getAllowedApplicationStatusTransitions,
  getApplicationStatusMenu,
  getApplicationStatusRank,
  getApplicationStatusUndoTarget,
  getNextApplicationStatus,
  isAllowedApplicationStatusTransition,
} from '@/lib/constants';
import { getApplicationStatusHistoryRowLabel } from '@/lib/utils';

const ALL_STATUSES: $Enums.ApplicationStatus[] = [
  ...APPLICATION_STATUS_VALUES,
  'withdrawn',
];

describe('getNextApplicationStatus', () => {
  it('walks the path forward for every unresolved status', () => {
    expect(getNextApplicationStatus('applied')).toBe('reached_out');
    expect(getNextApplicationStatus('reached_out')).toBe('interview_scheduled');
    expect(getNextApplicationStatus('interview_scheduled')).toBe('reviewing');
    expect(getNextApplicationStatus('reviewing')).toBe('accepted');
  });

  it('is null for both terminals', () => {
    expect(getNextApplicationStatus('accepted')).toBeNull();
    expect(getNextApplicationStatus('rejected')).toBeNull();
  });

  it('is null for both applicant-owned statuses', () => {
    expect(getNextApplicationStatus('draft')).toBeNull();
    expect(getNextApplicationStatus('withdrawn')).toBeNull();
  });
});

describe('APPLICATION_STATUS_PATH', () => {
  it('is the only place the order is written down — every entry is a real status', () => {
    for (const status of APPLICATION_STATUS_PATH)
      expect(ALL_STATUSES).toContain(status);
  });

  it('never repeats a status', () => {
    expect(new Set(APPLICATION_STATUS_PATH).size).toBe(
      APPLICATION_STATUS_PATH.length,
    );
  });
});

describe('getApplicationStatusRank', () => {
  it('increases along the path', () => {
    const applied = getApplicationStatusRank('applied');
    const reviewing = getApplicationStatusRank('reviewing');
    expect(applied).not.toBeNull();
    expect(reviewing).not.toBeNull();
    expect(reviewing!).toBeGreaterThan(applied!);
  });

  it('gives rejected the same rank as accepted', () => {
    expect(getApplicationStatusRank('rejected')).toBe(
      getApplicationStatusRank('accepted'),
    );
  });

  it('is null for draft and withdrawn', () => {
    expect(getApplicationStatusRank('draft')).toBeNull();
    expect(getApplicationStatusRank('withdrawn')).toBeNull();
  });
});

describe('getAllowedApplicationStatusTransitions', () => {
  it('gives draft and withdrawn no moves at all', () => {
    for (const status of ['draft', 'withdrawn'] as const)
      expect(getAllowedApplicationStatusTransitions(status)).toEqual([]);
  });

  it('is exactly the next step plus Accept/Reject for each unresolved status', () => {
    expect(new Set(getAllowedApplicationStatusTransitions('applied'))).toEqual(
      new Set(['reached_out', 'accepted', 'rejected']),
    );
    expect(
      new Set(getAllowedApplicationStatusTransitions('reached_out')),
    ).toEqual(new Set(['interview_scheduled', 'accepted', 'rejected']));
    expect(
      new Set(getAllowedApplicationStatusTransitions('interview_scheduled')),
    ).toEqual(new Set(['reviewing', 'accepted', 'rejected']));
  });

  it('dedupes reviewing, whose next step already is accepted', () => {
    const allowed = getAllowedApplicationStatusTransitions('reviewing');
    expect(new Set(allowed)).toEqual(new Set(['accepted', 'rejected']));
    expect(allowed.filter((s) => s === 'accepted')).toHaveLength(1);
  });

  it('gives both terminals no moves', () => {
    expect(getAllowedApplicationStatusTransitions('accepted')).toEqual([]);
    expect(getAllowedApplicationStatusTransitions('rejected')).toEqual([]);
  });

  it('never allows a move into draft or withdrawn', () => {
    for (const from of ALL_STATUSES)
      for (const to of getAllowedApplicationStatusTransitions(from)) {
        expect(to).not.toBe('draft');
        expect(to).not.toBe('withdrawn');
      }
  });
});

describe('isAllowedApplicationStatusTransition', () => {
  it('rejects reviewing -> interview_scheduled on the normal path', () => {
    expect(
      isAllowedApplicationStatusTransition('reviewing', 'interview_scheduled'),
    ).toBe(false);
  });

  it('rejects accepted -> rejected on the normal path', () => {
    expect(isAllowedApplicationStatusTransition('accepted', 'rejected')).toBe(
      false,
    );
  });

  it('allows Accept and Reject from every unresolved status, none of the others', () => {
    for (const status of ALL_STATUSES) {
      const isUnresolved = (
        UNRESOLVED_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
      ).includes(status);
      expect(isAllowedApplicationStatusTransition(status, 'accepted')).toBe(
        isUnresolved,
      );
      expect(isAllowedApplicationStatusTransition(status, 'rejected')).toBe(
        isUnresolved,
      );
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

describe('getApplicationStatusMenu', () => {
  it('hoists nothing — next is the raw path successor for every unresolved status', () => {
    expect(getApplicationStatusMenu('applied').next).toBe('reached_out');
    expect(getApplicationStatusMenu('reached_out').next).toBe(
      'interview_scheduled',
    );
    expect(getApplicationStatusMenu('interview_scheduled').next).toBe(
      'reviewing',
    );
    expect(getApplicationStatusMenu('reviewing').next).toBe('accepted');
  });

  it('holds both decisions when next is not a decision', () => {
    expect(getApplicationStatusMenu('applied').decisions).toEqual([
      'accepted',
      'rejected',
    ]);
  });

  it('dedupes reviewing — its next step already is accepted, so decisions holds only reject', () => {
    expect(getApplicationStatusMenu('reviewing').decisions).toEqual([
      'rejected',
    ]);
  });

  it('is empty (next and decisions) on both terminals', () => {
    for (const status of ['accepted', 'rejected'] as const) {
      const menu = getApplicationStatusMenu(status);
      expect(menu.next).toBeNull();
      expect(menu.decisions).toEqual([]);
    }
  });

  it('is empty (next and decisions) on both applicant-owned statuses', () => {
    for (const status of ['draft', 'withdrawn'] as const) {
      const menu = getApplicationStatusMenu(status);
      expect(menu.next).toBeNull();
      expect(menu.decisions).toEqual([]);
    }
  });

  it('never puts a move-back in either field', () => {
    for (const status of ALL_STATUSES) {
      const { next, decisions } = getApplicationStatusMenu(status);
      if (next) expect(getApplicationStatusRank(status)).not.toBeNull();
      expect(decisions).not.toContain('interview_scheduled');
      expect(decisions).not.toContain('reviewing');
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
