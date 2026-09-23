import { describe, expect, it } from 'vitest';

import { compareMergedApplicationRows } from '@/prisma/data/applications';

import type { ApplicationTableRow } from '@/lib/types';

function adminRow(overrides: {
  id: string;
  status: 'applied' | 'accepted' | 'rejected' | 'withdrawn';
  submittedAt: Date;
  name: string;
}): ApplicationTableRow {
  return {
    isDraft: false,
    id: overrides.id,
    status: overrides.status,
    submittedAt: overrides.submittedAt,
    applicantName: overrides.name,
    position: { id: 'position-1', title: 'Senator' },
    user: { id: `user-${overrides.id}`, name: overrides.name, email: '' },
  };
}

function draftRow(overrides: {
  id: string;
  updatedAt: Date;
  name: string;
}): ApplicationTableRow {
  return {
    isDraft: true,
    id: overrides.id,
    createdAt: overrides.updatedAt,
    updatedAt: overrides.updatedAt,
    submittedAt: null,
    position: { id: 'position-1', title: 'Senator' },
    user: { id: `user-${overrides.id}`, name: overrides.name, email: '' },
  };
}

const submittedEarly = adminRow({
  id: 'a-early',
  status: 'applied',
  submittedAt: new Date('2026-01-01'),
  name: 'Bob',
});
const submittedLate = adminRow({
  id: 'a-late',
  status: 'accepted',
  submittedAt: new Date('2026-06-01'),
  name: 'Alice',
});
const draftOld = draftRow({
  id: 'd-old',
  updatedAt: new Date('2026-02-01'),
  name: 'Carol',
});
const draftNew = draftRow({
  id: 'd-new',
  updatedAt: new Date('2026-05-01'),
  name: 'Dave',
});

const rows = [submittedEarly, submittedLate, draftOld, draftNew];

describe('compareMergedApplicationRows', () => {
  it('unsorted default clusters real-null drafts ahead of submitted rows, newest updatedAt first', () => {
    const sorted = [...rows].sort(compareMergedApplicationRows(undefined));
    expect(sorted.map((r) => r.id)).toEqual([
      'd-new',
      'd-old',
      'a-late',
      'a-early',
    ]);
  });

  it('date asc puts null (draft) submittedAt last', () => {
    const sorted = [...rows].sort(
      compareMergedApplicationRows({ field: 'date', direction: 'asc' }),
    );
    expect(sorted.map((r) => r.id)).toEqual([
      'a-early',
      'a-late',
      'd-old',
      'd-new',
    ]);
  });

  it('date desc puts null (draft) submittedAt first', () => {
    const sorted = [...rows].sort(
      compareMergedApplicationRows({ field: 'date', direction: 'desc' }),
    );
    expect(sorted.map((r) => r.id)).toEqual([
      'd-old',
      'd-new',
      'a-late',
      'a-early',
    ]);
  });

  it('name asc/desc sorts every row, draft or not, by user.name', () => {
    const asc = [...rows].sort(
      compareMergedApplicationRows({ field: 'name', direction: 'asc' }),
    );
    expect(asc.map((r) => r.id)).toEqual([
      'a-late',
      'a-early',
      'd-old',
      'd-new',
    ]);

    const desc = [...rows].sort(
      compareMergedApplicationRows({ field: 'name', direction: 'desc' }),
    );
    expect(desc.map((r) => r.id)).toEqual([
      'd-new',
      'd-old',
      'a-early',
      'a-late',
    ]);
  });

  it('status asc/desc treats every draft as the literal status "draft"', () => {
    const asc = [...rows].sort(
      compareMergedApplicationRows({ field: 'status', direction: 'asc' }),
    );
    expect(asc.map((r) => r.id)).toEqual([
      'a-late',
      'a-early',
      'd-old',
      'd-new',
    ]);
  });
});
