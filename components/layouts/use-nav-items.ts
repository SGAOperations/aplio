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

// Shared by Sidebar and MobileNav, so both agree on order, visibility, and active state.
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

  // A plain startsWith would also highlight a sibling like /positions-archive.
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return { navItems, logoHref, isActive };
}
