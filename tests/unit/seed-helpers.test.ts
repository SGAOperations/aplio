import { describe, expect, it } from 'vitest';

import type { $Enums } from '@/prisma/client';
import {
  BULK_ORIENTATION_APPLICANT_COUNT,
  generateBulkOrientationApplicants,
} from '@/prisma/seed/bulk';
import { defaultStatusTrail, spreadTrailInstants } from '@/prisma/seed/helpers';

import {
  APPLICATION_STATUS_VALUES,
  UNRESOLVED_APPLICATION_STATUSES,
  isAllowedApplicationStatusTransition,
} from '@/lib/constants';

const NON_DRAFT_STATUSES = APPLICATION_STATUS_VALUES.filter(
  (s) => s !== 'draft',
);

// Mirrors the applicant-owned moves that isAllowedApplicationStatusTransition
// deliberately excludes (that function only governs the reviewer graph).
function isApplicantMove(
  from: $Enums.ApplicationStatus,
  to: $Enums.ApplicationStatus,
): boolean {
  if (to === 'applied') return from === 'draft' || from === 'withdrawn';
  if (to === 'withdrawn')
    return (
      UNRESOLVED_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
    ).includes(from);
  return false;
}

function assertLegalTrail(trail: $Enums.ApplicationStatus[]) {
  let from: $Enums.ApplicationStatus = 'draft';
  for (const to of trail) {
    const legal =
      isApplicantMove(from, to) ||
      isAllowedApplicationStatusTransition(from, to);
    expect(legal, `${from} -> ${to} should be a legal step`).toBe(true);
    from = to;
  }
}

describe('defaultStatusTrail', () => {
  it('is empty for draft', () => {
    expect(defaultStatusTrail('draft')).toEqual([]);
  });

  it('ends at the status it was asked for', () => {
    for (const status of NON_DRAFT_STATUSES) {
      const trail = defaultStatusTrail(status);
      expect(trail[trail.length - 1]).toBe(status);
    }
  });

  it('is a legal sequence of applicant moves and reviewer transitions', () => {
    for (const status of NON_DRAFT_STATUSES)
      assertLegalTrail(defaultStatusTrail(status));
  });
});

describe("Frank's custom trail", () => {
  it('is a legal withdraw-and-resubmit sequence', () => {
    assertLegalTrail(['applied', 'withdrawn', 'applied', 'reached_out']);
  });
});

describe('generateBulkOrientationApplicants', () => {
  it('is deterministic across calls', () => {
    expect(generateBulkOrientationApplicants()).toEqual(
      generateBulkOrientationApplicants(),
    );
  });

  it('produces at least 60 applications covering every status', () => {
    const { applicationDefs } = generateBulkOrientationApplicants();
    expect(applicationDefs.length).toBeGreaterThanOrEqual(60);
    expect(applicationDefs.length).toBe(BULK_ORIENTATION_APPLICANT_COUNT);

    const statuses = new Set(applicationDefs.map((a) => a.status));
    for (const status of APPLICATION_STATUS_VALUES)
      expect(statuses.has(status)).toBe(true);
  });

  it('gives every applicant a distinct email', () => {
    const { applicantDefs } = generateBulkOrientationApplicants();
    const emails = new Set(applicantDefs.map((a) => a.email));
    expect(emails.size).toBe(applicantDefs.length);
  });
});

describe('spreadTrailInstants', () => {
  it('pins the first instant to start and stays monotonic within [start, end]', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-10T00:00:00.000Z');
    const instants = spreadTrailInstants(start, end, 4);

    expect(instants[0]).toEqual(start);
    expect(instants[instants.length - 1]).toEqual(end);
    for (let i = 1; i < instants.length; i++)
      expect(instants[i]!.getTime()).toBeGreaterThanOrEqual(
        instants[i - 1]!.getTime(),
      );
    for (const instant of instants) {
      expect(instant.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(instant.getTime()).toBeLessThanOrEqual(end.getTime());
    }
  });

  it('falls back to one-minute spacing when end does not leave room', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-01T00:00:00.000Z');
    const instants = spreadTrailInstants(start, end, 3);

    expect(instants[0]).toEqual(start);
    expect(instants[1]!.getTime() - instants[0]!.getTime()).toBe(60_000);
    expect(instants[2]!.getTime() - instants[1]!.getTime()).toBe(60_000);
  });

  it('returns a single instant at start for count 1, and nothing for count 0', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-10T00:00:00.000Z');
    expect(spreadTrailInstants(start, end, 1)).toEqual([start]);
    expect(spreadTrailInstants(start, end, 0)).toEqual([]);
  });
});
