'use client';

import Link from 'next/link';

import type { NavGroup, NavItem, SectionNavItem } from '@/lib/types';
import { cn } from '@/lib/utils';

import { SectionNavList } from '@/components/layouts/section-nav-list';
import { useSectionNav } from '@/components/layouts/use-section-nav';

interface NavListProps {
  topLevelItems: NavItem[];
  groups: NavGroup[];
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
  // Sheet links need the ~44px touch target; the desktop sidebar rows already clear it.
  touchFriendly?: boolean;
}

export function NavList({
  topLevelItems,
  groups,
  isActive,
  onNavigate,
  touchFriendly,
}: NavListProps) {
  const { sections, activeSectionId } = useSectionNav();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-2">
      <ul className="flex flex-col gap-1">
        {topLevelItems.map((item) => (
          <NavListItem
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            onNavigate={onNavigate}
            touchFriendly={touchFriendly}
            sections={sections}
            activeSectionId={activeSectionId}
          />
        ))}
      </ul>

      {groups.map((group) => (
        <div key={group.id}>
          <p
            id={group.id}
            className="text-muted-foreground px-3 pt-4 pb-1 text-xs font-medium tracking-wide uppercase"
          >
            {group.label}
          </p>
          <ul aria-labelledby={group.id} className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavListItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                onNavigate={onNavigate}
                touchFriendly={touchFriendly}
                sections={sections}
                activeSectionId={activeSectionId}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

interface NavListItemProps {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
  touchFriendly?: boolean;
  sections: SectionNavItem[];
  activeSectionId: string | null;
}

function NavListItem({
  item,
  isActive,
  onNavigate,
  touchFriendly,
  sections,
  activeSectionId,
}: NavListItemProps) {
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          touchFriendly && 'min-h-11',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        {item.label}
      </Link>

      {isActive && sections.length > 0 && (
        <SectionNavList
          sections={sections}
          activeId={activeSectionId}
          onNavigate={onNavigate}
          touchFriendly={touchFriendly}
        />
      )}
    </li>
  );
}
