'use client';

import posthog from 'posthog-js';

import { ACTION_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';

// A plain <a>, never a prefetching <Link>: a prefetch would sign the user out.
export function DeactivatedSignOut({ logoutHref }: { logoutHref: string }) {
  return (
    <Button className="w-full" asChild>
      <a href={logoutHref} onClick={() => posthog.reset()}>
        <ACTION_ICONS.signOut />
        Sign out
      </a>
    </Button>
  );
}
