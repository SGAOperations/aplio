import type {
  SectionNavItem,
  SectionPosition,
  SectionScrollMetrics,
} from '@/lib/types';

// Discovery selector for use-section-nav's querySelectorAll/MutationObserver scan.
export const SECTION_NAV_SELECTOR = '[data-section-nav][id]';

// Reading line: the fraction of clientHeight a section's top must cross to win.
export const SECTION_NAV_READING_LINE = 0.5;

// Slack for the top/bottom-of-page checks, in px.
export const SECTION_NAV_EDGE_TOLERANCE_PX = 1;

// Preserves document order; drops empty/duplicate ids or labels; fewer than
// two survivors means no sub-nav.
export function buildSectionNavItems(
  raw: Array<{ id: string; label: string | null }>,
): SectionNavItem[] {
  const seen = new Set<string>();
  const items: SectionNavItem[] = [];

  for (const { id, label } of raw) {
    if (!id || !label) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, label });
  }

  return items.length >= 2 ? items : [];
}

// Order: pinned id, top of page, bottom of page, else the last section whose
// top has crossed the reading line (falling back to the first).
export function selectActiveSectionId(
  sections: SectionPosition[],
  metrics: SectionScrollMetrics,
  pinnedId: string | null,
): string | null {
  const [first] = sections;
  if (!first) return null;

  if (pinnedId && sections.some((section) => section.id === pinnedId))
    return pinnedId;

  const { scrollTop, scrollHeight, clientHeight } = metrics;
  if (scrollTop <= SECTION_NAV_EDGE_TOLERANCE_PX) return first.id;

  const last = sections[sections.length - 1];
  if (
    last &&
    scrollTop + clientHeight >= scrollHeight - SECTION_NAV_EDGE_TOLERANCE_PX
  )
    return last.id;

  const readingLine = clientHeight * SECTION_NAV_READING_LINE;
  for (const section of [...sections].reverse())
    if (section.top <= readingLine) return section.id;

  return first.id;
}
