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

// Anonymous visitors may only reach Positions without being redirected to login.
// Home and My Applications are auth-gated and would bounce an unauthenticated user.
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
