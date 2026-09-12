import { describe, expect, it } from 'vitest';

import { buildSectionNavItems, selectActiveSectionId } from '@/lib/section-nav';

describe('buildSectionNavItems', () => {
  it('preserves document order', () => {
    expect(
      buildSectionNavItems([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ]),
    ).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ]);
  });

  it('drops entries with an empty id or label', () => {
    expect(
      buildSectionNavItems([
        { id: '', label: 'A' },
        { id: 'b', label: null },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ]),
    ).toEqual([
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ]);
  });

  it('drops duplicate ids, keeping the first occurrence', () => {
    expect(
      buildSectionNavItems([
        { id: 'a', label: 'A' },
        { id: 'a', label: 'A again' },
        { id: 'b', label: 'B' },
      ]),
    ).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
  });

  it('returns [] when fewer than two entries survive', () => {
    expect(buildSectionNavItems([])).toEqual([]);
    expect(buildSectionNavItems([{ id: 'a', label: 'A' }])).toEqual([]);
  });

  it('grows once a streamed section appears after mount', () => {
    const beforeStream = buildSectionNavItems([{ id: 'a', label: 'A' }]);
    expect(beforeStream).toEqual([]);

    const afterStream = buildSectionNavItems([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    expect(afterStream).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
  });
});

describe('selectActiveSectionId', () => {
  it('picks the first intersecting entry in document order', () => {
    expect(
      selectActiveSectionId(
        [
          { id: 'a', isIntersecting: false },
          { id: 'b', isIntersecting: true },
          { id: 'c', isIntersecting: true },
        ],
        null,
      ),
    ).toBe('b');
  });

  it('keeps the previous id when nothing intersects and it is still present', () => {
    expect(
      selectActiveSectionId(
        [
          { id: 'a', isIntersecting: false },
          { id: 'b', isIntersecting: false },
        ],
        'b',
      ),
    ).toBe('b');
  });

  it('falls back to the first entry when the previous id is gone', () => {
    expect(
      selectActiveSectionId(
        [
          { id: 'a', isIntersecting: false },
          { id: 'b', isIntersecting: false },
        ],
        'z',
      ),
    ).toBe('a');
  });

  it('falls back to the first entry scrolled past the last section', () => {
    expect(
      selectActiveSectionId(
        [
          { id: 'a', isIntersecting: false },
          { id: 'b', isIntersecting: false },
          { id: 'c', isIntersecting: false },
        ],
        'c',
      ),
    ).toBe('c');
  });

  it('returns null for an empty visibility list', () => {
    expect(selectActiveSectionId([], 'a')).toBeNull();
  });
});
