'use client';

import type { MouseEvent } from 'react';

import type { SectionNavItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SectionNavListProps {
  sections: SectionNavItem[];
  activeId: string | null;
  onNavigate?: () => void;
  touchFriendly?: boolean;
}

export function SectionNavList({
  sections,
  activeId,
  onNavigate,
  touchFriendly,
}: SectionNavListProps) {
  return (
    <ul className="border-sidebar-border mt-1 ml-4 flex flex-col gap-1 border-l pl-2">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            aria-current={section.id === activeId ? 'true' : undefined}
            onClick={(event) => handleClick(event, section.id, onNavigate)}
            className={cn(
              'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
              touchFriendly && 'min-h-11',
              section.id === activeId &&
                'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
            )}
          >
            {section.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

// preventDefault + replaceState keeps history flat on both surfaces; Sheet
// closes first so its exit animation doesn't fight the scroll.
function handleClick(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
  onNavigate?: () => void,
): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return;

  event.preventDefault();
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + '#' + id,
  );
  onNavigate?.();
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  });
}
