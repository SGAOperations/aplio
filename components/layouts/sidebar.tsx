'use client';

import Link from 'next/link';

import type { NavIdentity } from '@/lib/types';

import { Logo } from '@/components/layouts/logo';
import { NavList } from '@/components/layouts/nav-list';
import { useNavItems } from '@/components/layouts/use-nav-items';
import { UserMenu } from '@/components/layouts/user-menu';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isAdmin: boolean;
  identity: NavIdentity | null;
  canReviewApplications: boolean;
}

export function Sidebar({
  isAdmin,
  identity,
  canReviewApplications,
}: SidebarProps) {
  const { topLevelItems, groups, logoHref, isActive } = useNavItems({
    identity,
    isAdmin,
    canReviewApplications,
  });

  return (
    <aside className="bg-sidebar border-sidebar-border hidden h-full w-56 shrink-0 flex-col border-r md:flex">
      <div className="border-sidebar-border flex h-14 items-center border-b px-4">
        <Link href={logoHref} className="flex items-center gap-2">
          <Logo />
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight">Aplio</span>
            {process.env.version && (
              <span className="text-muted-foreground shrink-0 text-xs font-normal">
                v{process.env.version}
              </span>
            )}
          </span>
        </Link>
      </div>

      <NavList
        topLevelItems={topLevelItems}
        groups={groups}
        isActive={isActive}
      />

      <div className="border-sidebar-border mt-auto border-t p-2">
        {identity ? (
          <UserMenu identity={identity} />
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
