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

export const adminNavItems = [
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/global-questions', label: 'Global Questions', icon: ClipboardList },
];
