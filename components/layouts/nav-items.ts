import { FolderKanban } from 'lucide-react';

import { CONCEPT_ICONS } from '@/lib/icons';
import type { NavGroup, NavItem } from '@/lib/types';

export const homeNavItem: NavItem = {
  href: '/',
  label: 'Home',
  icon: CONCEPT_ICONS.home,
};

export const positionsNavItem: NavItem = {
  href: '/positions',
  label: 'Positions',
  icon: CONCEPT_ICONS.position,
};

export const applyNavItems: NavItem[] = [
  positionsNavItem,
  {
    href: '/applications',
    label: 'My Applications',
    icon: CONCEPT_ICONS.myApplication,
  },
];

// Shown to admins AND managers — anyone who can review applications.
export const manageReviewerNavItems: NavItem[] = [
  { href: '/manage/positions', label: 'Manage Positions', icon: FolderKanban },
  {
    href: '/manage/applications',
    label: 'Applications',
    icon: CONCEPT_ICONS.application,
  },
];

// Settings group: admin-only platform administration, not day-to-day review.
export const settingsNavItems: NavItem[] = [
  { href: '/users', label: 'Users', icon: CONCEPT_ICONS.user },
  {
    href: '/global-questions',
    label: 'Global Questions',
    icon: CONCEPT_ICONS.question,
  },
  { href: '/emails', label: 'Email Log', icon: CONCEPT_ICONS.email },
  { href: '/insights', label: 'Insights', icon: CONCEPT_ICONS.insights },
];

// Positions only: the others are auth-gated and would bounce to login.
export const anonymousNavItems: NavItem[] = [positionsNavItem];

/** Pure so it's testable without rendering — Manage/Settings groups, empty ones dropped. */
export function buildNavGroups(options: {
  canReviewApplications: boolean;
  isAdmin: boolean;
}): NavGroup[] {
  return [
    {
      id: 'nav-group-manage',
      label: 'Manage',
      items: options.canReviewApplications ? manageReviewerNavItems : [],
    },
    {
      id: 'nav-group-settings',
      label: 'Settings',
      items: options.isAdmin ? settingsNavItems : [],
    },
  ].filter((group) => group.items.length > 0);
}
