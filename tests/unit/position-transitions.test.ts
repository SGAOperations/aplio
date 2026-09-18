import { describe, expect, it } from 'vitest';

import type { PositionStatus } from '@/prisma/client';

import {
  POSITION_CLOSED_DRAFT_BLOCKED_ERROR,
  POSITION_DRAFT_CLOSE_BLOCKED_ERROR,
  POSITION_REOPEN_PAST_CLOSE_ERROR,
  POSITION_STATUS_TRANSITIONS,
  POSITION_STATUS_VALUES,
  POSITION_UNPUBLISH_BLOCKED_ERROR,
  getPositionStatusTransitionError,
  getPositionTransitionTargets,
} from '@/lib/constants';

const NO_APPLICATIONS = { hasApplications: false, closesAtPast: false };

describe('getPositionStatusTransitionError', () => {
  it('always allows saving the same status, regardless of context', () => {
    for (const status of POSITION_STATUS_VALUES) {
      expect(
        getPositionStatusTransitionError(status, status, {
          hasApplications: true,
          closesAtPast: true,
        }),
      ).toBeNull();
    }
  });

  it('rejects draft -> closed and closed -> draft — the two structurally missing pairs', () => {
    expect(
      getPositionStatusTransitionError('draft', 'closed', NO_APPLICATIONS),
    ).toBe(POSITION_DRAFT_CLOSE_BLOCKED_ERROR);
    expect(
      getPositionStatusTransitionError('closed', 'draft', NO_APPLICATIONS),
    ).toBe(POSITION_CLOSED_DRAFT_BLOCKED_ERROR);
  });

  it('rejects closed -> draft regardless of applications — it is never legal', () => {
    expect(
      getPositionStatusTransitionError('closed', 'draft', {
        hasApplications: true,
        closesAtPast: false,
      }),
    ).toBe(POSITION_CLOSED_DRAFT_BLOCKED_ERROR);
  });

  it('are the only structurally missing pairs — every other (from, to) is in the map', () => {
    const missing: [PositionStatus, PositionStatus][] = [];
    for (const from of POSITION_STATUS_VALUES)
      for (const to of POSITION_STATUS_VALUES) {
        if (from === to) continue;
        const allowed = (
          POSITION_STATUS_TRANSITIONS[from] as readonly PositionStatus[]
        ).includes(to);
        if (!allowed) missing.push([from, to]);
      }
    expect(missing).toEqual([
      ['draft', 'closed'],
      ['closed', 'draft'],
    ]);
  });

  it('allows open -> draft with no applications', () => {
    expect(
      getPositionStatusTransitionError('open', 'draft', NO_APPLICATIONS),
    ).toBeNull();
  });

  it('rejects open -> draft once any application exists', () => {
    const ctx = { hasApplications: true, closesAtPast: false };
    expect(getPositionStatusTransitionError('open', 'draft', ctx)).toBe(
      POSITION_UNPUBLISH_BLOCKED_ERROR,
    );
  });

  it('allows closed -> open when closesAt is null or in the future', () => {
    expect(
      getPositionStatusTransitionError('closed', 'open', NO_APPLICATIONS),
    ).toBeNull();
  });

  it('rejects closed -> open when closesAt is in the past', () => {
    expect(
      getPositionStatusTransitionError('closed', 'open', {
        hasApplications: false,
        closesAtPast: true,
      }),
    ).toBe(POSITION_REOPEN_PAST_CLOSE_ERROR);
  });

  it('never gates open -> closed on hasApplications or closesAtPast', () => {
    expect(
      getPositionStatusTransitionError('open', 'closed', {
        hasApplications: true,
        closesAtPast: true,
      }),
    ).toBeNull();
  });

  it('never gates draft -> open on hasApplications or closesAtPast', () => {
    expect(
      getPositionStatusTransitionError('draft', 'open', {
        hasApplications: true,
        closesAtPast: true,
      }),
    ).toBeNull();
  });
});

describe('getPositionTransitionTargets', () => {
  it('offers nothing to a manager on a draft — publishing is admin-only', () => {
    expect(
      getPositionTransitionTargets(false, 'draft', NO_APPLICATIONS),
    ).toEqual([]);
  });

  it('offers open to an admin on a draft', () => {
    expect(
      getPositionTransitionTargets(true, 'draft', NO_APPLICATIONS),
    ).toEqual(['open']);
  });

  it('orders an open position closed-first, then draft, matching the split button priority', () => {
    expect(getPositionTransitionTargets(true, 'open', NO_APPLICATIONS)).toEqual(
      ['closed', 'draft'],
    );
  });

  it('drops draft from an open position once applications exist', () => {
    expect(
      getPositionTransitionTargets(true, 'open', {
        hasApplications: true,
        closesAtPast: false,
      }),
    ).toEqual(['closed']);
  });

  it('offers only open from a closed position — draft is never a target', () => {
    expect(
      getPositionTransitionTargets(true, 'closed', NO_APPLICATIONS),
    ).toEqual(['open']);
  });

  it('drops open from a closed position past its close date, leaving no targets', () => {
    expect(
      getPositionTransitionTargets(true, 'closed', {
        hasApplications: false,
        closesAtPast: true,
      }),
    ).toEqual([]);
  });

  it('never offers open to a non-admin, from any status', () => {
    for (const from of POSITION_STATUS_VALUES)
      for (const hasApplications of [true, false])
        for (const closesAtPast of [true, false])
          expect(
            getPositionTransitionTargets(false, from, {
              hasApplications,
              closesAtPast,
            }),
          ).not.toContain('open');
  });

  it('never offers a move the resolver would reject', () => {
    for (const isAdmin of [true, false])
      for (const from of POSITION_STATUS_VALUES)
        for (const hasApplications of [true, false])
          for (const closesAtPast of [true, false]) {
            const ctx = { hasApplications, closesAtPast };
            const targets = getPositionTransitionTargets(isAdmin, from, ctx);
            for (const to of targets)
              expect(
                getPositionStatusTransitionError(from, to, ctx),
              ).toBeNull();
          }
  });
});
