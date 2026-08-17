'use client';

import { usePathname } from 'next/navigation';

import type { NavGroup, NavIdentity, NavItem } from '@/lib/types';

import {
  anonymousNavItems,
  applyNavItems,
  homeNavItem,
  manageAdminNavItems,
  manageReviewerNavItems,
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

  const manageItems = [
    ...(canReviewApplications ? manageReviewerNavItems : []),
    ...(isAdmin ? manageAdminNavItems : []),
  ];

  const topLevelItems = identity ? [homeNavItem] : anonymousNavItems;

  const groups: NavGroup[] = identity
    ? [
        { id: 'nav-group-apply', label: 'Apply', items: applyNavItems },
        ...(manageItems.length > 0
          ? [{ id: 'nav-group-manage', label: 'Manage', items: manageItems }]
          : []),
      ]
    : [];

  // Anonymous visitors land on /positions; authenticated users go to the dashboard.
  const logoHref = identity ? '/' : '/positions';

  // A plain startsWith would also highlight a sibling like /positions-archive.
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return { topLevelItems, groups, logoHref, isActive };
}
