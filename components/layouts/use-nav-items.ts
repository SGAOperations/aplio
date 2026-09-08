'use client';

import { usePathname } from 'next/navigation';

import type { NavGroup, NavIdentity, NavItem } from '@/lib/types';

import {
  anonymousNavItems,
  applyNavItems,
  homeNavItem,
  manageReviewerNavItems,
  settingsNavItems,
} from '@/components/layouts/nav-items';

interface UseNavItemsOptions {
  identity: NavIdentity | null;
  isAdmin: boolean;
  canReviewApplications: boolean;
}

interface UseNavItemsResult {
  topLevelItems: NavItem[];
  groups: NavGroup[];
  logoHref: string;
  isActive: (href: string) => boolean;
}

// Shared by Sidebar and MobileNav, so both agree on order, visibility, and active state.
export function useNavItems({
  identity,
  isAdmin,
  canReviewApplications,
}: UseNavItemsOptions): UseNavItemsResult {
  const pathname = usePathname();

  // Apply items sit ungrouped under Home; Manage and Settings each get a heading.
  const topLevelItems = identity
    ? [homeNavItem, ...applyNavItems]
    : anonymousNavItems;

  const groups: NavGroup[] = identity
    ? [
        {
          id: 'nav-group-manage',
          label: 'Manage',
          items: canReviewApplications ? manageReviewerNavItems : [],
        },
        {
          id: 'nav-group-settings',
          label: 'Settings',
          items: isAdmin ? settingsNavItems : [],
        },
      ].filter((group) => group.items.length > 0)
    : [];

  // Anonymous visitors land on /positions; authenticated users go to the dashboard.
  const logoHref = identity ? '/' : '/positions';

  // A plain startsWith would also highlight a sibling like /positions-archive.
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return { topLevelItems, groups, logoHref, isActive };
}
