import { FolderKanban } from 'lucide-react';

import { CONCEPT_ICONS } from '@/lib/icons';
import type { NavItem } from '@/lib/types';

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

// Shown to admins only — Users and Global Questions are admin-only.
export const manageAdminNavItems: NavItem[] = [
  { href: '/users', label: 'Users', icon: CONCEPT_ICONS.user },
  {
    href: '/global-questions',
    label: 'Global Questions',
    icon: CONCEPT_ICONS.question,
  },
];

// Positions only: the others are auth-gated and would bounce to login.
export const anonymousNavItems: NavItem[] = [positionsNavItem];
