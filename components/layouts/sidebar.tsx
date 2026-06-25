'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavIdentity } from '@/lib/types';
import { cn } from '@/lib/utils';

import { adminNavItems, baseNavItems } from '@/components/layouts/nav-items';
import { UserMenu } from '@/components/layouts/user-menu';

interface SidebarProps {
  isAdmin: boolean;
  identity: NavIdentity;
}

export function Sidebar({ isAdmin, identity }: SidebarProps) {
  const pathname = usePathname();
  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems;

  return (
    <aside className="bg-sidebar border-sidebar-border hidden h-full w-56 shrink-0 flex-col border-r md:flex">
      <div className="border-sidebar-border flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-icon.svg" alt="Aplio" width={32} height={32} />
          <span className="text-sm font-semibold tracking-tight">Aplio</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
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

      <div className="border-sidebar-border mt-auto border-t p-2">
        <UserMenu identity={identity} />
      </div>
    </aside>
  );
}
