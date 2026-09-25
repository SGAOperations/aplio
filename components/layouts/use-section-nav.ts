'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  SECTION_NAV_SELECTOR,
  buildSectionNavItems,
  selectActiveSectionId,
} from '@/lib/section-nav';
import type { SectionNavItem, SectionPosition } from '@/lib/types';

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

let pin: { id: string; settled: boolean } | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function armSettleTimer(): void {
  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    if (pin) pin.settled = true;
  }, 150);
}

// Module-level: the desktop sidebar and mobile Sheet each mount their own
// useSectionNav, and the Sheet unmounts right after a click.
export function scrollToSection(id: string): void {
  pin = { id, settled: false };
  document
    .getElementById('main-content')
    ?.dispatchEvent(new Event('section-nav:pin'));
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
  armSettleTimer();
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
    let rafId: number | null = null;

    function scheduleCompute(): void {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeActive();
      });
    }

    function computeActive(): void {
      const rootTop = main.getBoundingClientRect().top;
      const positions: SectionPosition[] = [];
      for (const section of currentSections) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        positions.push({
          id: section.id,
          top: el.getBoundingClientRect().top - rootTop,
        });
      }

      const next = selectActiveSectionId(
        positions,
        {
          scrollTop: main.scrollTop,
          scrollHeight: main.scrollHeight,
          clientHeight: main.clientHeight,
        },
        pin?.id ?? null,
      );
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

    function handleScroll(): void {
      if (pin?.settled) pin = null;
      else if (pin) armSettleTimer();
      scheduleCompute();
    }

    function scrollToInitialHashIfPresent(): void {
      if (hasScrolledToInitialHash) return;
      const hashId = window.location.hash.slice(1);
      if (!hashId) return;
      const matches = currentSections.some((section) => section.id === hashId);
      if (!matches) return;

      hasScrolledToInitialHash = true;
      scrollToSection(hashId);
    }

    function refresh(): void {
      const discovered = discoverSections(main);
      if (sectionsKey(discovered) !== sectionsKey(currentSections)) {
        currentSections = discovered;
        setSections(discovered);
        scrollToInitialHashIfPresent();
      }
      scheduleCompute();
    }

    refresh();

    main.addEventListener('scroll', handleScroll, { passive: true });
    main.addEventListener('section-nav:pin', scheduleCompute);
    const resizeObserver = new ResizeObserver(scheduleCompute);
    resizeObserver.observe(main);
    const mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(main, { childList: true, subtree: true });

    return () => {
      main.removeEventListener('scroll', handleScroll);
      main.removeEventListener('section-nav:pin', scheduleCompute);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      setSections([]);
      setActiveSectionId(null);
    };
  }, [pathname]);

  return { sections, activeSectionId };
}
