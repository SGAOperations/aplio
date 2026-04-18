'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { BriefcaseBusiness, FileText, Menu, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const navItems = [
  { href: '/positions', label: 'Positions', icon: BriefcaseBusiness },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/users', label: 'Users', icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-sidebar border-sidebar-border flex h-14 items-center border-b px-4 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <div className="bg-primary flex size-8 items-center justify-center rounded-lg shadow-sm">
          <span className="text-primary-foreground text-sm font-bold">A</span>
        </div>
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
          <SheetContent side="left">
            <SheetHeader className="border-sidebar-border border-b pb-4">
              <SheetTitle>
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <div className="bg-primary flex size-8 items-center justify-center rounded-lg shadow-sm">
                    <span className="text-primary-foreground text-sm font-bold">
                      A
                    </span>
                  </div>
                  <span className="text-sm font-semibold tracking-tight">
                    Aplio
                  </span>
                </Link>
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 p-2">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname.startsWith(href);
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
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
