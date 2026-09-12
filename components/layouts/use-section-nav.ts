'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  SECTION_NAV_ROOT_MARGIN,
  SECTION_NAV_SELECTOR,
  buildSectionNavItems,
  selectActiveSectionId,
} from '@/lib/section-nav';
import type { SectionNavItem } from '@/lib/types';

interface UseSectionNavResult {
  sections: SectionNavItem[];
  activeSectionId: string | null;
}

function discoverSections(main: HTMLElement): SectionNavItem[] {
  const raw = Array.from(
    main.querySelectorAll<HTMLElement>(SECTION_NAV_SELECTOR),
  ).map((el) => ({ id: el.id, label: el.getAttribute('data-section-nav') }));
  return buildSectionNavItems(raw);
}

function sectionsKey(sections: SectionNavItem[]): string {
  return sections.map((s) => `${s.id}|${s.label}`).join(',');
}

// Sole permitted useEffect: subscribes to native observers, not data fetching.
export function useSectionNav(): UseSectionNavResult {
  const pathname = usePathname();
  const [sections, setSections] = useState<SectionNavItem[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    const mainCandidate = document.getElementById('main-content');
    if (!mainCandidate) return;
    const main: HTMLElement = mainCandidate;

    let currentSections: SectionNavItem[] = [];
    let activeId: string | null = null;
    let skipNextHashSync = true;
    let hasScrolledToInitialHash = false;
    const visibility = new Map<string, boolean>();
    let observer: IntersectionObserver | null = null;

    function computeActive(): void {
      const entries = currentSections.map((section) => ({
        id: section.id,
        isIntersecting: visibility.get(section.id) ?? false,
      }));
      const next = selectActiveSectionId(entries, activeId);
      if (next === activeId) return;

      activeId = next;
      setActiveSectionId(next);

      if (skipNextHashSync) {
        skipNextHashSync = false;
        return;
      }
      if (next)
        history.replaceState(
          null,
          '',
          pathname + window.location.search + '#' + next,
        );
    }

    function subscribe(): void {
      observer?.disconnect();
      visibility.clear();
      if (currentSections.length === 0) {
        observer = null;
        return;
      }

      observer = new IntersectionObserver(
        (observerEntries) => {
          for (const entry of observerEntries)
            visibility.set(entry.target.id, entry.isIntersecting);
          computeActive();
        },
        { root: main, rootMargin: SECTION_NAV_ROOT_MARGIN, threshold: 0 },
      );

      for (const section of currentSections) {
        const el = document.getElementById(section.id);
        if (el) observer.observe(el);
      }
    }

    function scrollToInitialHashIfPresent(): void {
      if (hasScrolledToInitialHash) return;
      const hashId = window.location.hash.slice(1);
      if (!hashId) return;
      const matches = currentSections.some((section) => section.id === hashId);
      if (!matches) return;

      hasScrolledToInitialHash = true;
      document.getElementById(hashId)?.scrollIntoView({ block: 'start' });
    }

    function refresh(): void {
      const discovered = discoverSections(main);
      if (sectionsKey(discovered) === sectionsKey(currentSections)) return;

      currentSections = discovered;
      setSections(discovered);
      subscribe();
      scrollToInitialHashIfPresent();
    }

    refresh();

    const mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(main, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
      setSections([]);
      setActiveSectionId(null);
    };
  }, [pathname]);

  return { sections, activeSectionId };
}
