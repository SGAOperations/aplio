import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getDeactivatedSessionUser, getOptionalUser } from '@/lib/auth/server';
import { ACTION_ICONS } from '@/lib/icons';

import { DeactivatedSignOut } from '@/components/features/deactivated-sign-out';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Account Deactivated',
  robots: { index: false },
};

export default async function AccountDeactivatedPage() {
  const activeUser = await getOptionalUser();
  if (activeUser) redirect('/positions');

  const deactivatedUser = await getDeactivatedSessionUser();
  if (!deactivatedUser) redirect('/login');

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <ACTION_ICONS.deactivate className="text-muted-foreground size-10" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Account deactivated</h1>
        <p className="text-sm">
          Your account has been deactivated, so you can&apos;t access Aplio
          right now.
        </p>
        <p className="text-muted-foreground text-sm">
          If you think this is a mistake, contact an administrator to have it
          restored.
        </p>
      </div>
      <p className="text-muted-foreground text-xs">
        Signed in as {deactivatedUser.email}
      </p>
      <div className="flex w-full flex-col gap-2">
        <DeactivatedSignOut />
        <Button variant="ghost" asChild className="w-full">
          <Link href="/positions">
            <ACTION_ICONS.goTo />
            Browse open positions
          </Link>
        </Button>
      </div>
    </div>
  );
}
