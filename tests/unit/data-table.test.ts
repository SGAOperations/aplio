import { describe, expect, it } from 'vitest';

import {
  type DataTableColumn,
  compareValues,
  filterRows,
} from '@/lib/data-table';

describe('compareValues', () => {
  it('compares scalars as before', () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues('b', 'a')).toBeGreaterThan(0);
  });

  it('compares tuples left-to-right, first non-zero wins', () => {
    expect(compareValues([0, 'b'], [0, 'a'])).toBeGreaterThan(0);
    expect(compareValues([1, 'a'], [0, 'z'])).toBeGreaterThan(0);
    expect(compareValues([0, 'a'], [0, 'a'])).toBe(0);
  });

  it('sorts a null/undefined element after a present one at that position', () => {
    expect(compareValues([0, undefined], [0, 'a'])).toBeGreaterThan(0);
    expect(compareValues([0, 'a'], [0, undefined])).toBeLessThan(0);
  });

  it('sorts an equal-prefix shorter array first', () => {
    expect(compareValues([0], [0, 'a'])).toBeLessThan(0);
    expect(compareValues([0, 'a'], [0])).toBeGreaterThan(0);
  });
});

interface Row {
  id: string;
  name: string;
  positionId: string | null;
  positionTitle: string | null;
}

const rows: Row[] = [
  { id: '1', name: 'Alice', positionId: 'p1', positionTitle: 'Engineer' },
  { id: '2', name: 'Bob', positionId: 'p2', positionTitle: 'Recruiter' },
  { id: '3', name: 'Carol', positionId: null, positionTitle: null },
];

const columns: DataTableColumn<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (r) => r.name,
    searchValue: (r) => r.name,
  },
  {
    key: 'position',
    header: 'Position',
    cell: (r) => r.positionTitle ?? '',
    filterValue: (r) => (r.positionId ? [r.positionId] : []),
  },
];

describe('filterRows', () => {
  it('matches `query` only against columns with searchValue', () => {
    expect(filterRows(rows, columns, { query: 'engineer' })).toEqual([]);
    expect(filterRows(rows, columns, { query: 'alice' })).toEqual([rows[0]]);
  });

  it('matches a `filters` entry only against columns with filterValue', () => {
    expect(
      filterRows(rows, columns, { filters: [{ key: 'name', value: 'Alice' }] }),
    ).toEqual(rows);

    expect(
      filterRows(rows, columns, {
        filters: [{ key: 'position', value: 'p2' }],
      }),
    ).toEqual([rows[1]]);
  });

  it('composes query and filters with AND', () => {
    expect(
      filterRows(rows, columns, {
        query: 'bob',
        filters: [{ key: 'position', value: 'p2' }],
      }),
    ).toEqual([rows[1]]);

    expect(
      filterRows(rows, columns, {
        query: 'alice',
        filters: [{ key: 'position', value: 'p2' }],
      }),
    ).toEqual([]);
  });
});
