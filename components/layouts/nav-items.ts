import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Home,
  Inbox,
  Users,
} from 'lucide-react';

export const baseNavItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/positions', label: 'Positions', icon: BriefcaseBusiness },
  { href: '/my-applications', label: 'My Applications', icon: Inbox },
];

// Positions only: the others are auth-gated and would bounce to login.
export const anonymousNavItems = baseNavItems.filter(
  (item) => item.href === '/positions',
);

// Shown to admins AND managers — anyone who can review applications.
export const reviewerNavItems = [
  { href: '/applications', label: 'Applications', icon: FileText },
];

// Shown to admins only — Users and Global Questions are admin-only.
export const adminOnlyNavItems = [
  { href: '/users', label: 'Users', icon: Users },
  { href: '/global-questions', label: 'Global Questions', icon: ClipboardList },
];
