'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { ChevronUp, UserCircle } from 'lucide-react';

import { logoutBypassUser } from '@/prisma/services/dev-bypass';

import type { NavIdentity } from '@/lib/types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserMenuProps {
  identity: NavIdentity;
  onNavigate?: () => void;
  // 'sidebar' uses sidebar-context tokens (default, for sidebar/mobile-nav usage).
  // 'header' uses neutral tokens suitable for a plain header without sidebar context.
  variant?: 'sidebar' | 'header';
}

export function UserMenu({
  identity,
  onNavigate,
  variant = 'sidebar',
}: UserMenuProps) {
  const { name, email, roleLabel, isBypass } = identity;
  const displayName = name ?? email;
  const version = process.env.version;
  const [pending, startTransition] = useTransition();

  const triggerClassName =
    variant === 'header'
      ? 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors bg-transparent hover:bg-muted'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Account menu for ${displayName}`}
          className={triggerClassName}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {displayName}
              {version && (
                <span className="text-muted-foreground ml-1.5 shrink-0 text-xs font-normal">
                  v{version}
                </span>
              )}
            </p>
            <p className="text-muted-foreground text-xs">{roleLabel}</p>
          </div>
          <ChevronUp
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-muted-foreground text-xs">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className="flex items-center gap-2"
            onClick={onNavigate}
          >
            <UserCircle className="size-4" aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>
        {isBypass && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => startTransition(() => logoutBypassUser())}
              className="text-destructive cursor-pointer text-sm"
            >
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
