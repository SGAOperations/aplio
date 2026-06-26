'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Menu } from 'lucide-react';

import type { NavIdentity } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Logo } from '@/components/layouts/logo';
import {
  adminOnlyNavItems,
  anonymousNavItems,
  baseNavItems,
  reviewerNavItems,
} from '@/components/layouts/nav-items';
import { UserMenu } from '@/components/layouts/user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = identity
    ? [
        ...baseNavItems,
        ...(canReviewApplications ? reviewerNavItems : []),
        ...(isAdmin ? adminOnlyNavItems : []),
      ]
    : anonymousNavItems;

  // Anonymous visitors land on /positions; authenticated users go to the dashboard.
  const logoHref = identity ? '/' : '/positions';

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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
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

            <nav className="flex flex-col gap-1 p-2">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>

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
