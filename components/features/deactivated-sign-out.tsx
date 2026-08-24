'use client';

import { unstable_rethrow, useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { toast } from 'sonner';

import { signOutDeactivatedSession } from '@/prisma/actions/auth';

import { ACTION_ICONS } from '@/lib/icons';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';

export function DeactivatedSignOut() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        const result = await signOutDeactivatedSession();
        if (isError(result)) {
          toast.error(result.error);
          return;
        }
        toast.success('Signed out.');
        router.push('/login');
      } catch (error) {
        unstable_rethrow(error);
        console.error('Deactivated sign-out failed unexpectedly', error);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Button className="w-full" disabled={pending} onClick={handleSignOut}>
      {pending ? (
        <ACTION_ICONS.pending className="animate-spin" />
      ) : (
        <ACTION_ICONS.signOut />
      )}
      Sign out
    </Button>
  );
}
