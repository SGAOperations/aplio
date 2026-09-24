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
  const metrics = { scrollTop: 1200, scrollHeight: 3000, clientHeight: 800 };

  it('returns null for an empty section list', () => {
    expect(selectActiveSectionId([], metrics, null)).toBeNull();
  });

  it('ignores an edge-only overlap and picks the section below it', () => {
    const sections = [
      { id: 'a', top: 0 },
      { id: 'b', top: 24 },
    ];
    expect(selectActiveSectionId(sections, metrics, null)).toBe('b');
  });

  it('picks the lower section once its top has crossed the reading line, even with the upper tail visible', () => {
    const sections = [
      { id: 'a', top: -500 },
      { id: 'b', top: 300 },
    ];
    expect(selectActiveSectionId(sections, metrics, null)).toBe('b');
  });

  it('keeps the upper section while the lower section has not crossed the reading line', () => {
    const sections = [
      { id: 'a', top: -100 },
      { id: 'b', top: 500 },
    ];
    expect(selectActiveSectionId(sections, metrics, null)).toBe('a');
  });

  it('picks the last section at the bottom of the page, even when its top is below the reading line', () => {
    const sections = [
      { id: 'a', top: -400 },
      { id: 'b', top: 600 },
    ];
    expect(
      selectActiveSectionId(
        sections,
        { scrollTop: 2200, scrollHeight: 3000, clientHeight: 800 },
        null,
      ),
    ).toBe('b');
  });

  it('picks the first section at the top of the page, even when the second section is above the reading line', () => {
    const sections = [
      { id: 'a', top: 0 },
      { id: 'b', top: -50 },
    ];
    expect(
      selectActiveSectionId(
        sections,
        { scrollTop: 0, scrollHeight: 3000, clientHeight: 800 },
        null,
      ),
    ).toBe('a');
  });

  it('a pinned id beats the top, bottom and reading-line rules', () => {
    const sections = [
      { id: 'a', top: -400 },
      { id: 'b', top: 600 },
    ];
    expect(
      selectActiveSectionId(
        sections,
        { scrollTop: 2200, scrollHeight: 3000, clientHeight: 800 },
        'a',
      ),
    ).toBe('a');
  });

  it('ignores a pinned id that is not in the section list', () => {
    const sections = [
      { id: 'a', top: -100 },
      { id: 'b', top: 500 },
    ];
    expect(selectActiveSectionId(sections, metrics, 'z')).toBe('a');
  });

  it('falls back to the first section when none has crossed the reading line', () => {
    const sections = [
      { id: 'a', top: 450 },
      { id: 'b', top: 900 },
    ];
    expect(selectActiveSectionId(sections, metrics, null)).toBe('a');
  });

  it('returns the first section on a page that does not scroll', () => {
    const sections = [
      { id: 'a', top: 0 },
      { id: 'b', top: 200 },
    ];
    expect(
      selectActiveSectionId(
        sections,
        { scrollTop: 0, scrollHeight: 800, clientHeight: 800 },
        null,
      ),
    ).toBe('a');
  });
});
