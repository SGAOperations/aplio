'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Menu } from 'lucide-react';

import type { NavIdentity } from '@/lib/types';

import { Logo } from '@/components/layouts/logo';
import { NavList } from '@/components/layouts/nav-list';
import { useNavItems } from '@/components/layouts/use-nav-items';
import { UserMenu } from '@/components/layouts/user-menu';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MobileNavProps {
  isAdmin: boolean;
  identity: NavIdentity | null;
  canReviewApplications: boolean;
}

export function MobileNav({
  isAdmin,
  identity,
  canReviewApplications,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { topLevelItems, groups, logoHref, isActive } = useNavItems({
    identity,
    isAdmin,
    canReviewApplications,
  });

  return (
    <header className="bg-sidebar border-sidebar-border flex h-14 items-center border-b px-4 md:hidden">
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

      <div className="ml-auto">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0">
            <div className="border-sidebar-border flex h-14 items-center border-b px-4">
              <SheetTitle asChild>
                <Link
                  href={logoHref}
                  className="flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Logo />
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold tracking-tight">
                      Aplio
                    </span>
                    {process.env.version && (
                      <span className="text-muted-foreground shrink-0 text-xs font-normal">
                        v{process.env.version}
                      </span>
                    )}
                  </span>
                </Link>
              </SheetTitle>
            </div>

            <NavList
              topLevelItems={topLevelItems}
              groups={groups}
              isActive={isActive}
              onNavigate={() => setOpen(false)}
              touchFriendly
            />

            <div className="border-sidebar-border mt-auto border-t p-2">
              {identity ? (
                <UserMenu
                  identity={identity}
                  onNavigate={() => setOpen(false)}
                />
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
