'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Menu } from 'lucide-react';

import type { NavIdentity } from '@/lib/types';
import { cn } from '@/lib/utils';

import {
  adminOnlyNavItems,
  baseNavItems,
  reviewerNavItems,
} from '@/components/layouts/nav-items';
import { UserMenu } from '@/components/layouts/user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface MobileNavProps {
  isAdmin: boolean;
  identity: NavIdentity;
  canReviewApplications: boolean;
}

export function MobileNav({ isAdmin, identity, canReviewApplications }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navItems = [
    ...baseNavItems,
    ...(canReviewApplications ? reviewerNavItems : []),
    ...(isAdmin ? adminOnlyNavItems : []),
  ];

  return (
    <header className="bg-sidebar border-sidebar-border flex h-14 items-center border-b px-4 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo-icon.svg" alt="Aplio" width={32} height={32} />
        <span className="text-sm font-semibold tracking-tight">Aplio</span>
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
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Image
                    src="/logo-icon.svg"
                    alt="Aplio"
                    width={32}
                    height={32}
                  />
                  <span className="text-sm font-semibold tracking-tight">
                    Aplio
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
              <UserMenu identity={identity} onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
