import { describe, expect, it } from 'vitest';

import type { PositionStatus } from '@/prisma/client';

import {
  POSITION_DRAFT_CLOSE_BLOCKED_ERROR,
  POSITION_REOPEN_PAST_CLOSE_ERROR,
  POSITION_STATUS_TRANSITIONS,
  POSITION_STATUS_VALUES,
  POSITION_UNPUBLISH_BLOCKED_ERROR,
  getPositionStatusOptions,
  getPositionStatusTransitionError,
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

  it('rejects draft -> closed — the only structurally missing pair', () => {
    expect(
      getPositionStatusTransitionError('draft', 'closed', NO_APPLICATIONS),
    ).toBe(POSITION_DRAFT_CLOSE_BLOCKED_ERROR);
  });

  it('is the only structurally missing pair — every other (from, to) is in the map', () => {
    const missing: [PositionStatus, PositionStatus][] = [];
    for (const from of POSITION_STATUS_VALUES)
      for (const to of POSITION_STATUS_VALUES) {
        if (from === to) continue;
        const allowed = (
          POSITION_STATUS_TRANSITIONS[from] as readonly PositionStatus[]
        ).includes(to);
        if (!allowed) missing.push([from, to]);
      }
    expect(missing).toEqual([['draft', 'closed']]);
  });

  it('allows open/closed -> draft with no applications', () => {
    expect(
      getPositionStatusTransitionError('open', 'draft', NO_APPLICATIONS),
    ).toBeNull();
    expect(
      getPositionStatusTransitionError('closed', 'draft', NO_APPLICATIONS),
    ).toBeNull();
  });

  it('rejects open/closed -> draft once any application exists', () => {
    const ctx = { hasApplications: true, closesAtPast: false };
    expect(getPositionStatusTransitionError('open', 'draft', ctx)).toBe(
      POSITION_UNPUBLISH_BLOCKED_ERROR,
    );
    expect(getPositionStatusTransitionError('closed', 'draft', ctx)).toBe(
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

describe('getPositionStatusOptions', () => {
  it('omits closed from a draft position for both roles', () => {
    for (const isAdmin of [true, false]) {
      const values = getPositionStatusOptions(
        isAdmin,
        'draft',
        NO_APPLICATIONS,
      ).map((o) => o.value);
      expect(values).not.toContain('closed');
    }
  });

  it('omits draft from an open position with applications', () => {
    const values = getPositionStatusOptions(true, 'open', {
      hasApplications: true,
      closesAtPast: false,
    }).map((o) => o.value);
    expect(values).not.toContain('draft');
  });

  it('omits open from a closed position past its close date', () => {
    const values = getPositionStatusOptions(true, 'closed', {
      hasApplications: false,
      closesAtPast: true,
    }).map((o) => o.value);
    expect(values).not.toContain('open');
  });

  it('never offers a move the resolver would reject', () => {
    for (const isAdmin of [true, false])
      for (const from of POSITION_STATUS_VALUES)
        for (const hasApplications of [true, false])
          for (const closesAtPast of [true, false]) {
            const ctx = { hasApplications, closesAtPast };
            const options = getPositionStatusOptions(isAdmin, from, ctx);
            for (const opt of options)
              expect(
                getPositionStatusTransitionError(from, opt.value, ctx),
              ).toBeNull();
          }
  });
});
