import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Home,
  Inbox,
  Users,
} from 'lucide-react';

import type { NavItem } from '@/lib/types';

export const homeNavItem: NavItem = { href: '/', label: 'Home', icon: Home };

export const positionsNavItem: NavItem = {
  href: '/positions',
  label: 'Positions',
  icon: BriefcaseBusiness,
};

export const applyNavItems: NavItem[] = [
  positionsNavItem,
  { href: '/my-applications', label: 'My Applications', icon: Inbox },
];

// Shown to admins AND managers — anyone who can review applications.
// Positions is in addition to Apply's own entry — same role-adaptive /positions page.
export const manageReviewerNavItems: NavItem[] = [
  { href: '/applications', label: 'Applications', icon: FileText },
  positionsNavItem,
];

// Shown to admins only — Users and Global Questions are admin-only.
export const manageAdminNavItems: NavItem[] = [
  { href: '/users', label: 'Users', icon: Users },
  { href: '/global-questions', label: 'Global Questions', icon: ClipboardList },
];

// Positions only: the others are auth-gated and would bounce to login.
export const anonymousNavItems: NavItem[] = [positionsNavItem];
