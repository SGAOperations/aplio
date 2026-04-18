'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BriefcaseBusiness, FileText, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/positions', label: 'Positions', icon: BriefcaseBusiness },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/users', label: 'Users', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar border-sidebar-border flex h-full w-56 shrink-0 flex-col border-r">
      <div className="border-sidebar-border flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary flex size-8 items-center justify-center rounded-lg shadow-sm">
            <span className="text-primary-foreground text-sm font-bold">A</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Aplio</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
