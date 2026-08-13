'use client';

import { usePathname } from 'next/navigation';

import type { NavIdentity } from '@/lib/types';

import {
  adminOnlyNavItems,
  anonymousNavItems,
  baseNavItems,
  reviewerNavItems,
} from '@/components/layouts/nav-items';

interface UseNavItemsOptions {
  identity: NavIdentity | null;
  isAdmin: boolean;
  canReviewApplications: boolean;
}

interface UseNavItemsResult {
  navItems: typeof baseNavItems;
  logoHref: string;
  isActive: (href: string) => boolean;
}

// Shared by Sidebar and MobileNav so both agree on item order, visibility, and what
// counts as active.
export function useNavItems({
  identity,
  isAdmin,
  canReviewApplications,
}: UseNavItemsOptions): UseNavItemsResult {
  const pathname = usePathname();

  const navItems = identity
    ? [
        ...baseNavItems,
        ...(canReviewApplications ? reviewerNavItems : []),
        ...(isAdmin ? adminOnlyNavItems : []),
      ]
    : anonymousNavItems;

  // Anonymous visitors land on /positions; authenticated users go to the dashboard.
  const logoHref = identity ? '/' : '/positions';

  // Exact match or a nested sub-route — a plain startsWith would falsely
  // highlight a future sibling route sharing the same prefix (e.g. /positions-archive).
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return { navItems, logoHref, isActive };
}
