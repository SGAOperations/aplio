'use client';

import { ChevronUp } from 'lucide-react';

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
}

export function UserMenu({ identity }: UserMenuProps) {
  const { email, roleLabel, isBypass } = identity;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Account menu for ${email}`}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{email}</p>
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
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-muted-foreground text-xs">{roleLabel}</p>
        </DropdownMenuLabel>
        {isBypass && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={logoutBypassUser}>
                <button
                  type="submit"
                  className="text-destructive w-full cursor-pointer text-left text-sm"
                >
                  Log out
                </button>
              </form>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
