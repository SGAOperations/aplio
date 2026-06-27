'use client';

import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import {
  ChevronUp,
  LogOut,
  Monitor,
  Moon,
  Sun,
  SunMoon,
  UserCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { logoutBypassUser } from '@/prisma/services/dev-bypass';

import { authClient } from '@/lib/auth/client';
import type { NavIdentity } from '@/lib/types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserMenuProps {
  identity: NavIdentity;
  onNavigate?: () => void;
  // 'sidebar' uses sidebar-context tokens (default, for sidebar/mobile-nav usage).
  // 'header' uses neutral tokens suitable for a plain header without sidebar context.
  variant?: 'sidebar' | 'header';
}

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

export function UserMenu({
  identity,
  onNavigate,
  variant = 'sidebar',
}: UserMenuProps) {
  const { name, email, roleLabel, isBypass } = identity;
  const displayName = name ?? email;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // next-themes is loaded with { ssr: false }; `theme` is undefined on first
  // render before the provider resolves. Default to 'system' to match
  // defaultTheme so the radio shows a selection without a flash.
  const { theme = 'system', setTheme } = useTheme();

  const triggerClassName =
    variant === 'header'
      ? 'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors bg-transparent hover:bg-muted'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors';

  function handleLogout() {
    startTransition(async () => {
      if (isBypass) {
        await logoutBypassUser();
        return;
      }
      try {
        await authClient.signOut();
        toast.success('Signed out.');
        router.push('/login');
        router.refresh();
      } catch {
        toast.error('Could not sign out. Please try again.');
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Account menu for ${displayName}`}
          className={triggerClassName}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs">{roleLabel}</p>
          </div>
          <ChevronUp
            className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-muted-foreground text-xs">{roleLabel}</p>
          {email !== displayName && (
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          )}
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
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <SunMoon className="size-4" aria-hidden />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={handleLogout}
          className="cursor-pointer text-sm"
        >
          <LogOut className="size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
