import type { SectionNavItem, SectionVisibility } from '@/lib/types';

// Discovery selector for use-section-nav's querySelectorAll/MutationObserver scan.
export const SECTION_NAV_SELECTOR = '[data-section-nav][id]';

// Top 30% of <main> — tall enough that some section overlaps it at any mid-page scroll position.
export const SECTION_NAV_ROOT_MARGIN = '0px 0px -70% 0px';

// Preserves document order; drops empty/duplicate ids or labels; fewer than
// two survivors means no sub-nav (per the ticket's acceptance criteria).
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

// First intersecting entry in document order wins. When none intersects,
// keep previousId if it's still in the list, else fall back to the first.
export function selectActiveSectionId(
  visibility: SectionVisibility[],
  previousId: string | null,
): string | null {
  const [first] = visibility;
  if (!first) return null;

  const intersecting = visibility.find((entry) => entry.isIntersecting);
  if (intersecting) return intersecting.id;

  if (previousId && visibility.some((entry) => entry.id === previousId))
    return previousId;

  return first.id;
}
